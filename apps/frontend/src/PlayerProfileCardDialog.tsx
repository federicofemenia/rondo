import { useEffect, useState } from 'react';
import type { PublicProfileDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
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
  sportId: string;
  sportName?: string;
  onClose: () => void;
  /** "Ver comentarios" never opens a second Dialog on top of this one -- the caller closes this card and opens PlayerRatingCommentsDialog instead. */
  onShowComments: () => void;
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

export function StarsRow({ label, value }: { label: string; value: number | null }) {
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
 * The "player card" opened by tapping a candidate. Biography and ratings
 * come from GET /:id/public-profile, always scoped to the sport of the
 * match the candidate was found in (never a cross-sport blend) -- fetched
 * only once the dialog actually opens for a given userId, never bundled
 * into the candidates list. "Ver comentarios" hands off to
 * PlayerRatingCommentsDialog instead of nesting a second Dialog in here.
 */
function PlayerProfileCardDialog({ open, userId, sportId, sportName, onClose, onShowComments }: PlayerProfileCardDialogProps) {
  const api = useApi();

  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    let cancelled = false;
    setProfile(null);
    setProfileError(null);
    setProfileLoading(true);

    const load = async () => {
      try {
        const response = await api.get<{ data: PublicProfileDto }>(`/api/v1/users/${userId}/public-profile?sportId=${sportId}`);
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
  }, [open, userId, sportId]);

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

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Valoraciones en {profile.ratings.sportName}
            </Typography>

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
                Sin valoraciones en {profile.ratings.sportName}
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
              onClick={onShowComments}
              sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.4)', color: '#fff', borderRadius: 999, '&:hover': { borderColor: '#fff' } }}
            >
              {profile.ratings.commentsCount > 0 ? `Ver comentarios (${profile.ratings.commentsCount})` : 'Ver comentarios'}
            </Button>
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default PlayerProfileCardDialog;
