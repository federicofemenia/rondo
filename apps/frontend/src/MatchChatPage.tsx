import { useEffect, useRef, useState } from 'react';
import type { MatchChatMessageDto, MatchChatResponseDto, MatchStatusDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { ApiError, useApi } from './apiClient';

type MatchChatPageProps = {
  matchId: string;
  status: MatchStatusDto;
};

const POLL_INTERVAL_MS = 10_000;

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function MessageBubble({ message }: { message: MatchChatMessageDto }) {
  const isMine = message.isCurrentUser;
  return (
    <Stack direction="row" spacing={2} justifyContent={isMine ? 'flex-end' : 'flex-start'}>
      {!isMine ? (
        <Avatar
          src={message.author.avatarUrl ?? undefined}
          sx={{ width: 32, height: 32, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', flexShrink: 0 }}
        >
          {!message.author.avatarUrl ? <PersonRoundedIcon sx={{ color: 'text.secondary', fontSize: '1rem' }} /> : null}
        </Avatar>
      ) : null}
      <Box sx={{ maxWidth: '75%' }}>
        {!isMine ? (
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            {message.author.displayName}
          </Typography>
        ) : null}
        <Card
          variant="outlined"
          sx={{
            p: 3,
            borderColor: isMine ? 'primary.main' : 'divider',
            bgcolor: isMine ? 'rgba(46, 204, 113, 0.16)' : 'background.default',
          }}
        >
          <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</Typography>
        </Card>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: isMine ? 'right' : 'left' }}>
          {formatMessageTime(message.createdAt)}
        </Typography>
      </Box>
    </Stack>
  );
}

function closedMessageFor(status: MatchStatusDto): string {
  if (status === 'CANCELLED') {
    return 'El partido fue cancelado. El chat quedó cerrado.';
  }
  if (status === 'EXPIRED') {
    return 'El partido venció y el chat quedó cerrado.';
  }
  return 'El período de chat posterior al partido finalizó.';
}

function MatchChatPage({ matchId, status }: MatchChatPageProps) {
  const api = useApi();
  const [chat, setChat] = useState<MatchChatResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const endOfListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let denied = false;

    const load = async () => {
      if (cancelled || denied) {
        return;
      }
      try {
        const response = await api.get<{ data: MatchChatResponseDto }>(`/api/v1/matches/${matchId}/chat/messages`);
        if (cancelled) {
          return;
        }
        setChat(response.data);
        setLoadError(null);
      } catch (caught) {
        if (cancelled) {
          return;
        }
        if (caught instanceof ApiError && caught.status === 403) {
          denied = true;
          setAccessDenied(true);
        } else {
          setLoadError(describeError(caught, 'No pudimos cargar el chat. Reintentá más tarde.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const intervalId = setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    endOfListRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [chat?.messages.length]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const response = await api.post<{ data: MatchChatMessageDto }>(`/api/v1/matches/${matchId}/chat/messages`, { content });
      setChat((current) => (current ? { ...current, messages: [...current.messages, response.data] } : current));
      setDraft('');
    } catch (caught) {
      setSendError(describeError(caught, 'No pudimos enviar el mensaje. Reintentá.'));
    } finally {
      setSending(false);
    }
  };

  if (accessDenied) {
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
        <Alert severity="error">No tenés acceso a este chat.</Alert>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: chat && chat.canSend ? '140px' : 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Chat del partido
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Coordiná el partido con el organizador y los jugadores confirmados, todo dentro de la app.
        </Typography>
      </Card>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : loadError ? (
        <Alert severity="error">{loadError}</Alert>
      ) : chat ? (
        <>
          <Stack spacing={4} sx={{ mb: 4 }}>
            {chat.messages.length === 0 ? (
              <Typography color="text.secondary">Todavía no hay mensajes. ¡Escribí el primero!</Typography>
            ) : (
              chat.messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            <div ref={endOfListRef} />
          </Stack>

          {chat.closed ? (
            <Card variant="outlined" sx={{ p: 4, borderColor: 'divider', bgcolor: 'background.default' }}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Este chat ya está cerrado.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Podés consultar los mensajes anteriores, pero ya no se pueden enviar mensajes.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {closedMessageFor(status)}
              </Typography>
            </Card>
          ) : (
            <Stack spacing={2}>
              {sendError ? <Alert severity="error">{sendError}</Alert> : null}
              <Stack direction="row" spacing={3}>
                <TextField
                  aria-label="Mensaje"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Escribí un mensaje"
                  disabled={sending}
                  fullWidth
                />
                <Button variant="contained" onClick={() => void handleSend()} disabled={sending || !draft.trim()} sx={{ px: 6 }}>
                  {sending ? 'Enviando…' : 'Enviar'}
                </Button>
              </Stack>
            </Stack>
          )}
        </>
      ) : null}
    </Box>
  );
}

export default MatchChatPage;
