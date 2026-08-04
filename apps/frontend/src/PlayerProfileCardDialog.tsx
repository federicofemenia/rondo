import { useEffect, useState } from 'react';
import type { PublicProfileDto, RatingCommentDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { ApiError, useApi } from './apiClient';

type PlayerProfileCardDialogProps = {
  open: boolean;
  userId: string | null;
  sportName?: string;
  onClose: () => void;
};

// A collectible-card look per sport, not a copy of any existing brand's card
// design -- just a gradient + centered avatar + chips + stars treatment.
const SPORT_GRADIENTS: Record<string, string> = {
  Fútbol: 'linear-gradient(160deg, #1f7a4d 0%, #0c3b23 100%)',
  Pádel: 'linear-gradient(160deg, #1f5fa8 0%, #0c2b52 100%)',
};
const DEFAULT_GRADIENT = 'linear-gradient(160deg, #3a3a3a 0%, #141414 100%)';

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatCommentDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR').format(new Date(iso));
}

function StarsRow({ label, value }: { label: string; value: number | null }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', minWidth: 68 }}>
        {label}
      </Typography>
      <Rating
        value={value ?? 0}
        precision={0.5}
        readOnly
        size="small"
        icon={<StarRoundedIcon fontSize="inherit" sx={{ color: '#FFD166' }} />}
        emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'rgba(255,255,255,0.25)' }} />}
      />
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
        {value !== null ? value.toFixed(1) : '-'}
      </Typography>
    </Stack>
  );
}

/**
 * The "player card" opened by tapping a candidate. Biography comes from
 * GET /:id/public-profile, fetched only once the dialog actually opens for
 * a given userId -- never bundled into the candidates list. Comments are
 * fetched only once "Ver comentarios" is tapped, never before.
 */
function PlayerProfileCardDialog({ open, userId, sportName, onClose }: PlayerProfileCardDialogProps) {
  const api = useApi();

  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<RatingCommentDto[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    let cancelled = false;
    setProfile(null);
    setProfileError(null);
    setProfileLoading(true);
    setShowComments(false);
    setComments(null);
    setCommentsError(null);

    const load = async () => {
      try {
        const response = await api.get<{ data: PublicProfileDto }>(`/api/v1/users/${userId}/public-profile`);
        if (!cancelled) {
          setProfile(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setProfileError(describeError(caught, 'No pudimos cargar el perfil. Reintentá más tarde.'));
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const handleShowComments = async () => {
    setShowComments(true);
    if (comments !== null || !userId) {
      return;
    }

    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const response = await api.get<{ data: RatingCommentDto[] }>(`/api/v1/users/${userId}/rating-comments`);
      setComments(response.data);
    } catch (caught) {
      setCommentsError(describeError(caught, 'No pudimos cargar los comentarios. Reintentá más tarde.'));
    } finally {
      setCommentsLoading(false);
    }
  };

  const gradient = (sportName && SPORT_GRADIENTS[sportName]) ?? DEFAULT_GRADIENT;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { background: gradient, color: '#fff', borderRadius: '20px', overflow: 'hidden' } } }}
    >
      <IconButton
        aria-label="Cerrar"
        onClick={onClose}
        size="small"
        sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.85)', zIndex: 1 }}
      >
        <CloseRoundedIcon fontSize="small" />
      </IconButton>

      <DialogContent sx={{ pt: 6, pb: 5, px: 4 }}>
        {profileLoading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress sx={{ color: '#fff' }} />
          </Stack>
        ) : profileError ? (
          <Alert severity="error">{profileError}</Alert>
        ) : profile ? (
          <Stack alignItems="center" spacing={2}>
            <Avatar
              src={profile.avatarUrl ?? undefined}
              sx={{ width: 96, height: 96, border: '3px solid rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.15)' }}
            >
              {!profile.avatarUrl ? <PersonRoundedIcon sx={{ fontSize: '2.5rem', color: '#fff' }} /> : null}
            </Avatar>

            <Typography variant="h2" sx={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center' }}>
              {profile.displayName}
            </Typography>

            {profile.positions.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
                {profile.positions.map((position) => (
                  <Chip key={position} label={position} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 }} />
                ))}
              </Stack>
            ) : null}

            <Divider sx={{ width: '100%', borderColor: 'rgba(255,255,255,0.2)' }} />

            {profile.ratings.count > 0 ? (
              <Stack spacing={1} alignItems="flex-start">
                <StarsRow label="Juego" value={profile.ratings.gameplayAverage} />
                <StarsRow label="Conducta" value={profile.ratings.conductAverage} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  {profile.ratings.count} {profile.ratings.count === 1 ? 'valoración' : 'valoraciones'}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Sin valoraciones
              </Typography>
            )}

            {profile.biography ? (
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', whiteSpace: 'pre-wrap', textAlign: 'center' }}
              >
                "{profile.biography}"
              </Typography>
            ) : null}

            <Button
              variant="outlined"
              onClick={() => void handleShowComments()}
              sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.4)', color: '#fff', borderRadius: 999, '&:hover': { borderColor: '#fff' } }}
            >
              Ver comentarios
            </Button>

            {showComments ? (
              <Box sx={{ width: '100%', mt: 2 }}>
                {commentsLoading ? (
                  <Stack alignItems="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} sx={{ color: '#fff' }} />
                  </Stack>
                ) : commentsError ? (
                  <Alert severity="error">{commentsError}</Alert>
                ) : comments && comments.length > 0 ? (
                  <Stack spacing={2}>
                    {comments.map((comment) => (
                      <Box key={comment.id} sx={{ p: 3, borderRadius: '12px', bgcolor: 'rgba(0,0,0,0.25)', textAlign: 'left' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {comment.authorDisplayName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            {formatCommentDate(comment.createdAt)}
                          </Typography>
                        </Stack>
                        <Stack spacing={0.5} sx={{ mb: 1 }}>
                          <StarsRow label="Juego" value={comment.gameplayScore} />
                          <StarsRow label="Conducta" value={comment.conductScore} />
                        </Stack>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          "{comment.comment}"
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                          {comment.sportName} • {comment.modalityName}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                    Todavía no recibió comentarios escritos.
                  </Typography>
                )}
              </Box>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default PlayerProfileCardDialog;
