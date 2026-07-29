import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type CandidateStatus = 'Pendiente de confirmación' | 'Aceptado' | 'Rechazado';

type InvitationsPageProps = {
  invitedCandidates?: string[];
  participants?: string[];
  declinedCandidates?: string[];
};

const statusStyles: Record<CandidateStatus, { bgcolor: string; color: string }> = {
  'Pendiente de confirmación': { bgcolor: 'rgba(245, 197, 66, 0.16)', color: 'warning.main' },
  Aceptado: { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light' },
  Rechazado: { bgcolor: 'rgba(255, 77, 79, 0.16)', color: 'error.main' },
};

function InvitationsPage({ invitedCandidates = [], participants = [], declinedCandidates = [] }: InvitationsPageProps) {
  const candidates = invitedCandidates.map((name) => {
    const status: CandidateStatus = declinedCandidates.includes(name)
      ? 'Rechazado'
      : participants.includes(name)
        ? 'Aceptado'
        : 'Pendiente de confirmación';
    return { name, status };
  });

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Candidatos
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Acá aparecen todos los jugadores que invitaste, con el estado de su confirmación.
        </Typography>

        {candidates.length === 0 ? (
          <Typography color="text.secondary">Todavía no invitaste a ningún candidato.</Typography>
        ) : (
          <Stack spacing={2}>
            {candidates.map((candidate) => (
              <Card
                key={candidate.name}
                variant="outlined"
                sx={{ p: 4, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, bgcolor: 'background.default', borderColor: 'divider' }}
              >
                <Typography variant="h3" component="h2">
                  {candidate.name}
                </Typography>
                <Chip label={candidate.status} size="small" sx={{ fontWeight: 700, ...statusStyles[candidate.status] }} />
              </Card>
            ))}
          </Stack>
        )}
      </Card>
    </Box>
  );
}

export default InvitationsPage;
