import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import StadiumRoundedIcon from '@mui/icons-material/StadiumRounded';
import type { AdminClubDetailDto } from '@rondo/contracts';
import CreateClubDialog from './CreateClubDialog';
import { useAdminClubs } from './useAdminClubs';

type AdminDashboardPageProps = {
  onBack?: () => void;
  onOpenClub?: (clubId: string) => void;
};

// Admin screens get a wide, desktop-priority layout instead of the app's
// usual maxWidth: 480 mobile-first container -- the rest of the app is a
// pocket-sized player experience, but club administration is a
// desk/back-office task most admins will do from a laptop. Still scrolls
// cleanly and stays single-column down to a phone width.
const ADMIN_CONTAINER_MAX_WIDTH = { xs: '100%', sm: 640, md: 900, lg: 1200 };

function AdminDashboardPage({ onBack, onOpenClub }: AdminDashboardPageProps) {
  const { clubs, loading, error, reload } = useAdminClubs();
  const [createOpen, setCreateOpen] = useState(false);

  const isSuperadmin = clubs.some((club) => club.myRole === 'SUPERADMIN');

  const handleCreated = (club: AdminClubDetailDto) => {
    setCreateOpen(false);
    reload();
    onOpenClub?.(club.id);
  };

  return (
    <Box component="main" sx={{ maxWidth: ADMIN_CONTAINER_MAX_WIDTH, mx: 'auto', px: 4, pt: 5, pb: 12 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 5 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton aria-label="Volver" onClick={onBack} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Box>
            <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
              Administración
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mis clubes
            </Typography>
          </Box>
        </Stack>
        {isSuperadmin ? (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
            Crear club
          </Button>
        ) : null}
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert severity="error">No pudimos cargar tus clubes. Reintentá más tarde.</Alert>
      ) : clubs.length === 0 ? (
        <Typography color="text.secondary">Todavía no administrás ningún club.</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {clubs.map((club) => (
            <Card
              key={club.id}
              variant="outlined"
              component="button"
              onClick={() => onOpenClub?.(club.id)}
              sx={{
                p: 4,
                textAlign: 'left',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Stack direction="row" spacing={2} alignItems="center">
                  <StadiumRoundedIcon sx={{ color: 'primary.main' }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{club.name}</Typography>
                    {club.city ? (
                      <Typography variant="caption" color="text.secondary">
                        {club.city}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
                <ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />
              </Stack>

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip
                  label={club.isActive ? 'Activo' : 'Inactivo'}
                  size="small"
                  sx={club.isActive ? { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 } : { bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700 }}
                />
                <Chip
                  label={`${club.courtsCount} ${club.courtsCount === 1 ? 'cancha' : 'canchas'}`}
                  size="small"
                  sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }}
                />
                <Chip
                  label={club.myRole === 'SUPERADMIN' ? 'Superadmin' : 'Administrador'}
                  size="small"
                  sx={{ bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700 }}
                />
              </Stack>
            </Card>
          ))}
        </Box>
      )}

      <CreateClubDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </Box>
  );
}

export default AdminDashboardPage;
