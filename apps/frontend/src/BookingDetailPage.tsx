import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import EntityPickerDialog from './EntityPickerDialog';
import type { PickerItem } from './EntityPickerDialog';
import type { BookingEntity } from './types';

type BookingDetailPageProps = {
  booking: BookingEntity;
  linkedMatchSummary?: { sport: string; modality: string } | null;
  unlinkedMatches: PickerItem[];
  onBack?: () => void;
  onCreateMatch?: () => void;
  onAssociateMatch?: (matchId: string) => void;
  onOpenMatch?: () => void;
};

function BookingDetailPage({
  booking,
  linkedMatchSummary,
  unlinkedMatches,
  onBack,
  onCreateMatch,
  onAssociateMatch,
  onOpenMatch,
}: BookingDetailPageProps) {
  const [associateOpen, setAssociateOpen] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 5 }}>
          <IconButton aria-label="Volver" onClick={onBack} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Reserva</Typography>
          <Box sx={{ width: 40 }} />
        </Stack>

        <Card variant="outlined" sx={{ p: 6, borderColor: 'divider', mb: 6 }}>
          <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 4 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(77, 163, 255, 0.16)' }}>
              <PlaceRoundedIcon sx={{ color: 'info.main' }} />
            </Avatar>
            <Box>
              <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
                {booking.courtName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {booking.courtSubtitle} • {booking.clubName}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={`${booking.dateLabel} • ${booking.time}`}
            sx={{ bgcolor: 'background.default', color: 'text.primary', fontWeight: 700 }}
          />
        </Card>

        {linkedMatchSummary ? (
          <Card variant="outlined" sx={{ borderColor: 'divider' }}>
            <Button
              fullWidth
              onClick={onOpenMatch}
              sx={{ p: 4, display: 'flex', justifyContent: 'space-between', color: 'text.primary', textAlign: 'left' }}
              endIcon={<ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700 }}>
                  Partido asociado
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {linkedMatchSummary.sport} • {linkedMatchSummary.modality}
                </Typography>
              </Box>
            </Button>
          </Card>
        ) : (
          <Card variant="outlined" sx={{ p: 6, borderColor: 'divider' }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <WarningAmberRoundedIcon sx={{ color: 'warning.main' }} />
              <Typography sx={{ fontWeight: 700 }}>Sin partido asociado</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Esta reserva todavía no tiene un partido asociado.
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <Button variant="contained" onClick={onCreateMatch}>
                Crear partido
              </Button>
              <Button variant="outlined" onClick={() => setAssociateOpen(true)}>
                Asociar partido existente
              </Button>
            </Stack>
          </Card>
        )}
      </Box>

      <EntityPickerDialog
        open={associateOpen}
        onClose={() => setAssociateOpen(false)}
        title="Asociar un partido existente"
        items={unlinkedMatches}
        emptyLabel="No tenés partidos sin reserva asociada."
        onSelect={(id) => {
          onAssociateMatch?.(id);
          setAssociateOpen(false);
        }}
      />
    </Box>
  );
}

export default BookingDetailPage;
