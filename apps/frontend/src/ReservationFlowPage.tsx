import { useState } from 'react';
import type { ComponentType } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import SportsTennisRoundedIcon from '@mui/icons-material/SportsTennisRounded';

export type ConfirmedBooking = {
  courtName: string;
  courtSubtitle: string;
  dateLabel: string;
  time: string;
};

type ReservationFlowPageProps = {
  onBack?: () => void;
  onConfirm?: (booking: ConfirmedBooking) => void;
  contextLabel?: string;
};

type SlotStatus = 'disponible' | 'pocos' | 'completo' | 'no-disponible';

const days = [
  { key: 'lun26', label: 'Lun', date: 26, month: 'May' },
  { key: 'mar27', label: 'Mar', date: 27, month: 'May' },
  { key: 'mie28', label: 'Mié', date: 28, month: 'May' },
  { key: 'jue29', label: 'Jue', date: 29, month: 'May' },
  { key: 'vie30', label: 'Vie', date: 30, month: 'May' },
  { key: 'sab31', label: 'Sáb', date: 31, month: 'May' },
  { key: 'dom01', label: 'Dom', date: 1, month: 'Jun' },
];

const courts = [
  { key: 'cancha1', name: 'Cancha 1', subtitle: 'Panorámica' },
  { key: 'cancha2', name: 'Cancha 2', subtitle: 'Vidrio' },
  { key: 'cancha3', name: 'Cancha 3', subtitle: 'Premium' },
];

const hours = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];

const statusMatrix: Record<string, SlotStatus> = {
  '07:00-cancha1': 'no-disponible',
  '07:00-cancha2': 'no-disponible',
  '07:00-cancha3': 'no-disponible',
  '08:00-cancha1': 'disponible',
  '08:00-cancha2': 'pocos',
  '08:00-cancha3': 'disponible',
  '09:00-cancha1': 'disponible',
  '09:00-cancha2': 'disponible',
  '09:00-cancha3': 'pocos',
  '10:00-cancha1': 'disponible',
  '10:00-cancha2': 'disponible',
  '10:00-cancha3': 'disponible',
  '11:00-cancha1': 'pocos',
  '11:00-cancha2': 'disponible',
  '11:00-cancha3': 'disponible',
  '12:00-cancha1': 'disponible',
  '12:00-cancha2': 'pocos',
  '12:00-cancha3': 'disponible',
  '13:00-cancha1': 'completo',
  '13:00-cancha2': 'pocos',
  '13:00-cancha3': 'completo',
  '14:00-cancha1': 'pocos',
  '14:00-cancha2': 'disponible',
  '14:00-cancha3': 'pocos',
  '15:00-cancha1': 'no-disponible',
  '15:00-cancha2': 'no-disponible',
  '15:00-cancha3': 'no-disponible',
};

const statusConfig: Record<SlotStatus, { label: string; icon: ComponentType<SvgIconProps>; color: string; bg: string; interactive: boolean }> = {
  disponible: { label: 'Disponible', icon: CheckRoundedIcon, color: 'primary.light', bg: 'rgba(46, 204, 113, 0.12)', interactive: true },
  pocos: { label: 'Pocos', icon: AccessTimeRoundedIcon, color: 'warning.main', bg: 'rgba(245, 197, 66, 0.12)', interactive: true },
  completo: { label: 'Completo', icon: CloseRoundedIcon, color: 'error.main', bg: 'rgba(255, 77, 79, 0.12)', interactive: false },
  'no-disponible': { label: 'No disp.', icon: RemoveRoundedIcon, color: 'text.secondary', bg: 'transparent', interactive: false },
};

const legendItems: { status: SlotStatus; label: string; dotColor: string }[] = [
  { status: 'disponible', label: 'Disponible', dotColor: '#2ECC71' },
  { status: 'pocos', label: 'Pocos turnos', dotColor: '#F5C542' },
  { status: 'completo', label: 'Completo', dotColor: '#FF4D4F' },
  { status: 'no-disponible', label: 'No disponible', dotColor: '#4B5563' },
];

function ReservationFlowPage({ onBack, onConfirm, contextLabel }: ReservationFlowPageProps) {
  const [selectedDay, setSelectedDay] = useState('mie28');
  const [selectedSlot, setSelectedSlot] = useState<{ hour: string; courtKey: string } | null>({ hour: '10:00', courtKey: 'cancha2' });

  const selectedDayInfo = days.find((day) => day.key === selectedDay) ?? days[0]!;
  const selectedCourt = selectedSlot ? courts.find((court) => court.key === selectedSlot.courtKey) : null;

  const handleSelectSlot = (hour: string, courtKey: string) => {
    const status = statusMatrix[`${hour}-${courtKey}`];
    if (!status || !statusConfig[status].interactive) {
      return;
    }
    setSelectedSlot({ hour, courtKey });
  };

  const handleConfirm = () => {
    if (!selectedSlot || !selectedCourt) {
      return;
    }
    onConfirm?.({
      courtName: selectedCourt.name,
      courtSubtitle: selectedCourt.subtitle,
      dateLabel: `${selectedDayInfo.label} ${selectedDayInfo.date} ${selectedDayInfo.month}`,
      time: selectedSlot.hour,
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: 4, width: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
          <IconButton aria-label="Volver" onClick={onBack} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" component="h1" sx={{ fontSize: '1rem' }}>
              Elegí día y horario
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Paso 1 de 3
            </Typography>
          </Box>
          <IconButton aria-label="Ayuda" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            <HelpOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 5 }}>
          {[0, 1, 2].map((segment) => (
            <Box key={segment} sx={{ flex: 1, height: 4, borderRadius: 999, bgcolor: segment === 0 ? 'primary.main' : 'divider' }} />
          ))}
        </Stack>

        <Card
          variant="outlined"
          sx={{ p: 3, mb: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'rgba(46, 204, 113, 0.16)' }}>
              <SportsTennisRoundedIcon sx={{ color: 'primary.main' }} />
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Pádel</Typography>
              <Typography variant="caption" color="text.secondary">
                {contextLabel ?? 'Reserva independiente'}
              </Typography>
            </Box>
          </Stack>
          <Stack alignItems="flex-end">
            <Stack direction="row" spacing={1} alignItems="center">
              <PeopleAltRoundedIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Jugadores
              </Typography>
            </Stack>
            <Typography sx={{ fontWeight: 700 }}>4 - 8</Typography>
          </Stack>
        </Card>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography sx={{ fontWeight: 700 }}>Seleccioná el día</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'primary.light', cursor: 'pointer' }}>
            <CalendarMonthRoundedIcon sx={{ fontSize: '1rem' }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Ver calendario
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mb: 5, overflowX: 'auto', pb: 1 }}>
          {days.map((day) => (
            <Box
              key={day.key}
              component="button"
              type="button"
              onClick={() => setSelectedDay(day.key)}
              sx={{
                flexShrink: 0,
                minWidth: 56,
                textAlign: 'center',
                p: 2,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: selectedDay === day.key ? 'primary.main' : 'divider',
                bgcolor: selectedDay === day.key ? 'rgba(46, 204, 113, 0.12)' : 'background.paper',
                color: selectedDay === day.key ? 'primary.light' : 'text.primary',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: 'inherit' }}>
                {day.label}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'inherit' }}>{day.date}</Typography>
              <Typography variant="caption" color="text.secondary">
                {day.month}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mb: 5 }}>
          {legendItems.map((item) => (
            <Stack key={item.status} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '999px', bgcolor: item.dotColor }} />
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Typography sx={{ fontWeight: 700, mb: 3 }}>Elegí un horario</Typography>

        <Box sx={{ overflowX: 'auto', mb: 4 }}>
          <Box sx={{ minWidth: 420 }}>
            <Stack direction="row" sx={{ mb: 2 }}>
              <Box sx={{ width: 56, flexShrink: 0 }} />
              {courts.map((court) => (
                <Box key={court.key} sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {court.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {court.subtitle}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Stack spacing={2}>
              {hours.map((hour) => (
                <Stack key={hour} direction="row" alignItems="center">
                  <Box sx={{ width: 56, flexShrink: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {hour}
                    </Typography>
                  </Box>
                  {courts.map((court) => {
                    const status = statusMatrix[`${hour}-${court.key}`] ?? 'no-disponible';
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    const isSelected = selectedSlot?.hour === hour && selectedSlot?.courtKey === court.key;
                    return (
                      <Box key={court.key} sx={{ flex: 1, px: 0.5 }}>
                        <Button
                          fullWidth
                          size="small"
                          aria-label={`${court.name} ${hour} ${config.label}`}
                          onClick={() => handleSelectSlot(hour, court.key)}
                          startIcon={<Icon sx={{ fontSize: '0.85rem !important' }} />}
                          disabled={!config.interactive}
                          sx={{
                            fontSize: '0.65rem',
                            px: 0.5,
                            minWidth: 0,
                            color: isSelected ? '#0B0D0F' : config.color,
                            bgcolor: isSelected ? 'primary.main' : config.bg,
                            border: '1px solid',
                            borderColor: isSelected ? 'primary.main' : config.color,
                            '&.Mui-disabled': { color: config.color, opacity: 0.5, borderColor: config.color },
                          }}
                        >
                          {config.label}
                        </Button>
                      </Box>
                    );
                  })}
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      {selectedSlot && selectedCourt ? (
        <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', px: 4, py: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ maxWidth: 480, mx: 'auto' }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
              <CalendarMonthRoundedIcon sx={{ color: 'primary.main', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 700, display: 'block' }}>
                  Seleccionado
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {selectedDayInfo.label} {selectedDayInfo.date} {selectedDayInfo.month} • {selectedSlot.hour}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedCourt.name} • {selectedCourt.subtitle}
                </Typography>
              </Box>
            </Stack>
            <Button variant="contained" onClick={handleConfirm} endIcon={<ArrowForwardRoundedIcon />} sx={{ borderRadius: 999, flexShrink: 0 }}>
              Continuar
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

export default ReservationFlowPage;
