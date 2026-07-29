import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

export type CandidateReview = {
  id: number;
  author: string;
  conduct: number;
  skill: number;
  comment: string;
};

type PlayerReviewsDialogProps = {
  open: boolean;
  onClose: () => void;
  playerName: string;
  reviews: CandidateReview[];
};

function PlayerReviewsDialog({ open, onClose, playerName, reviews }: PlayerReviewsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        Valoraciones de {playerName}
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {reviews.length === 0 ? (
            <Typography color="text.secondary">Sin valoraciones todavía</Typography>
          ) : (
            reviews.map((review) => (
              <Card key={review.id} variant="outlined" sx={{ p: 3, bgcolor: 'background.default', borderColor: 'divider' }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Avatar sx={{ width: 32, height: 32 }}>{review.author.charAt(0)}</Avatar>
                  <Typography sx={{ fontWeight: 700 }}>{review.author}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Conducta {review.conduct}/5 • Juego {review.skill}/5
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {review.comment}
                </Typography>
              </Card>
            ))
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default PlayerReviewsDialog;
