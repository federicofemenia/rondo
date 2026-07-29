import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

type ChatMessage = {
  id: number;
  author: string;
  text: string;
};

type MatchChatPageProps = {
  initialMessages?: { author: string; text: string }[];
  onSendMessage?: (text: string) => void;
};

const initialMessages: ChatMessage[] = [
  { id: 1, author: 'Mauro', text: 'Buenísimo, nos vemos a las 19.' },
  { id: 2, author: 'Lina', text: 'Perfecto, yo llevo la pelota.' },
];

function MatchChatPage({ initialMessages: incomingMessages = [], onSendMessage }: MatchChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (incomingMessages.length === 0) {
      return;
    }

    const normalized = incomingMessages.map((message, index) => ({
      id: Date.now() + index,
      author: message.author,
      text: message.text,
    }));

    setMessages((current) => [...current, ...normalized]);
  }, [incomingMessages]);

  const sendMessage = () => {
    if (!draft.trim()) {
      return;
    }

    setMessages((current) => [...current, { id: Date.now(), author: 'Vos', text: draft.trim() }]);
    onSendMessage?.(draft.trim());
    setDraft('');
  };

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Chat del partido
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Coordiná el partido con los jugadores confirmados, todo dentro de la app.
        </Typography>

        <Stack spacing={2} sx={{ mb: 4 }}>
          {messages.map((message) => (
            <Card key={message.id} variant="outlined" sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider' }}>
              <Typography component="strong" sx={{ fontWeight: 700 }}>
                {message.author}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {message.text}
              </Typography>
            </Card>
          ))}
        </Stack>

        <Stack direction="row" spacing={3}>
          <TextField
            aria-label="Mensaje"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribí un mensaje"
            fullWidth
          />
          <Button variant="contained" onClick={sendMessage} sx={{ px: 6 }}>
            Enviar
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}

export default MatchChatPage;
