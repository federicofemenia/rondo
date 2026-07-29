import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

type Invitation = {
  id: number;
  name: string;
  status: 'Pendiente' | 'Aceptada' | 'Rechazada';
};

const initialInvitations: Invitation[] = [
  { id: 1, name: 'Mauro', status: 'Pendiente' },
  { id: 2, name: 'Lina', status: 'Pendiente' },
];

type InvitationsPageProps = {
  invitedCandidates?: string[];
};

function InvitationsPage({ invitedCandidates = [] }: InvitationsPageProps) {
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);

  useEffect(() => {
    if (invitedCandidates.length === 0) {
      return;
    }

    setInvitations((current) => {
      const existingNames = new Set(current.map((invitation) => invitation.name.toLowerCase()));
      const newEntries = invitedCandidates
        .filter((name) => !existingNames.has(name.toLowerCase()))
        .map((name, index) => ({
          id: current.length + index + 1,
          name,
          status: 'Pendiente' as const,
        }));

      return [...current, ...newEntries];
    });
  }, [invitedCandidates]);

  const handleResponse = (id: number, status: Invitation['status']) => {
    setInvitations((current) => current.map((invitation) => (invitation.id === id ? { ...invitation, status } : invitation)));
  };

  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pb: 12 }}>
      <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
        <Typography variant="h1" sx={{ mb: 2 }}>
          Candidatos pendientes
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
          <Chip label="En revisión" sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 }} />
          <Chip label="Controles del organizador" sx={{ bgcolor: 'background.default', color: 'info.main', fontWeight: 700 }} />
        </Stack>

        <Stack spacing={2}>
          {invitations.map((invitation) => (
            <Card
              key={invitation.id}
              variant="outlined"
              sx={{ p: 4, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, bgcolor: 'background.default', borderColor: 'divider' }}
            >
              <Box>
                <Typography variant="h3" component="h2" sx={{ mb: 0.5 }}>
                  {invitation.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Estado: {invitation.status}
                </Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" color="primary" onClick={() => handleResponse(invitation.id, 'Aceptada')}>
                  Aceptar
                </Button>
                <Button variant="outlined" color="error" onClick={() => handleResponse(invitation.id, 'Rechazada')}>
                  Rechazar
                </Button>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Card>
    </Box>
  );
}

export default InvitationsPage;
