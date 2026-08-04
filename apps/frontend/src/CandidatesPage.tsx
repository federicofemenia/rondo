import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MatchCandidatesSection from './MatchCandidatesSection';
import type { CandidateMatchSummary } from './MatchCandidatesSection';
import PageFooter from './PageFooter';

type CandidatesPageProps = {
  matchId: string;
  matchSummary?: CandidateMatchSummary | null;
  onFinish?: () => void;
};

function CandidatesPage({ matchId, matchSummary, onFinish }: CandidatesPageProps) {
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: onFinish ? '120px' : 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Candidatos compatibles
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
          {matchSummary?.sport ? (
            <Chip label={`Compatibles con ${matchSummary.sport}`} sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 }} />
          ) : null}
          {matchSummary?.modality ? (
            <Chip label={matchSummary.modality} sx={{ bgcolor: 'background.default', color: 'info.main', fontWeight: 700 }} />
          ) : null}
          {matchSummary?.clubName ? (
            <Chip label={matchSummary.clubName} sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }} />
          ) : null}
        </Stack>

        <MatchCandidatesSection matchId={matchId} matchSummary={matchSummary} />
      </Card>

      {onFinish ? (
        <PageFooter>
          <Button fullWidth variant="contained" size="large" onClick={onFinish} sx={{ borderRadius: 999 }}>
            Finalizar
          </Button>
        </PageFooter>
      ) : null}
    </Box>
  );
}

export default CandidatesPage;
