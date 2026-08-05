import type { RatingsSummaryDto } from '@rondo/contracts';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StarRoundedIcon from '@mui/icons-material/StarRounded';

/**
 * Inline gameplay/conduct stars + count, shared by the Candidatos list
 * (MatchCandidatesSection) and the Jugadores tab roster (MatchPlayersPage)
 * so a player's ratings always look the same wherever they show up in
 * Rondo.
 */
function PlayerRatingsSummary({ ratings }: { ratings: RatingsSummaryDto }) {
  if (ratings.count === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Sin valoraciones en {ratings.sportName}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Rating
          value={ratings.gameplayAverage ?? 0}
          precision={0.5}
          readOnly
          size="small"
          icon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'primary.main' }} />}
          emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'divider' }} />}
        />
        <Typography variant="caption" color="text.secondary">
          Juego
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Rating
          value={ratings.conductAverage ?? 0}
          precision={0.5}
          readOnly
          size="small"
          icon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'primary.main' }} />}
          emptyIcon={<StarRoundedIcon fontSize="inherit" sx={{ color: 'divider' }} />}
        />
        <Typography variant="caption" color="text.secondary">
          Conducta
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {ratings.count} {ratings.count === 1 ? 'valoración' : 'valoraciones'} · {ratings.commentsCount}{' '}
        {ratings.commentsCount === 1 ? 'comentario' : 'comentarios'}
      </Typography>
    </Stack>
  );
}

export default PlayerRatingsSummary;
