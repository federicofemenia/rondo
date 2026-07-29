import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export type PlayerRating = {
  conduct: number;
  skill: number;
  comment?: string;
};

type ReviewItem = {
  id: number;
  name: string;
  conduct: number;
  skill: number;
};

type MatchRatingsPageProps = {
  participants?: string[];
  ratings?: Record<string, PlayerRating>;
  onRatePlayer?: (name: string, rating: PlayerRating) => void;
};

const initialReviews: ReviewItem[] = [
  { id: 1, name: 'Mauro', conduct: 5, skill: 5 },
  { id: 2, name: 'Lina', conduct: 4, skill: 4 },
];

function MatchRatingsPage({ participants = [], ratings = {}, onRatePlayer }: MatchRatingsPageProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [conduct, setConduct] = useState(5);
  const [skill, setSkill] = useState(5);
  const [comment, setComment] = useState('');

  const mergedReviews = useMemo(() => {
    const fromParticipants = participants.map((name, index) => ({
      id: 100 + index,
      name,
      conduct: ratings[name]?.conduct ?? 4,
      skill: ratings[name]?.skill ?? 4,
    }));
    const combined = [...reviews, ...fromParticipants.filter((candidate) => !reviews.some((existing) => existing.name === candidate.name))];
    return combined;
  }, [participants, ratings, reviews]);

  const handleRate = (name: string) => {
    setReviews((current) => current.map((review) => (review.name === name ? { ...review, conduct, skill } : review)));
    onRatePlayer?.(name, { conduct, skill, comment: comment.trim() || undefined });
    setComment('');
  };

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Valoraciones
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Calificá la conducta y el nivel de juego de cada participante. El comentario es opcional.
        </Typography>

        <Stack spacing={3}>
          {mergedReviews.map((review) => (
            <Card key={review.id} variant="outlined" sx={{ p: 4, bgcolor: 'background.default', borderColor: 'divider' }}>
              <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>
                {review.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Conducta actual: {review.conduct}/5 • Juego actual: {review.skill}/5
              </Typography>

              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <TextField
                  select
                  label="Conducta"
                  size="small"
                  value={conduct}
                  onChange={(event) => setConduct(Number(event.target.value))}
                  slotProps={{ select: { native: true } }}
                  fullWidth
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Cómo jugó"
                  size="small"
                  value={skill}
                  onChange={(event) => setSkill(Number(event.target.value))}
                  slotProps={{ select: { native: true } }}
                  fullWidth
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </TextField>
              </Stack>

              <TextField
                label="Comentario (opcional)"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                multiline
                minRows={2}
                fullWidth
                sx={{ mb: 3 }}
              />

              <Button variant="contained" onClick={() => handleRate(review.name)}>
                Calificar
              </Button>
            </Card>
          ))}
        </Stack>
      </Card>
    </Box>
  );
}

export default MatchRatingsPage;
