import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { AvailabilitySlotDraft } from './availability';
import { WEEKDAY_LABELS, WEEKDAY_OPTIONS, findConflictingSlotIndex } from './availability';
import { formatMinutesAsTime, parseTimeToMinutes } from './scheduleFormat';

const STEP_MINUTES = 30;

function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += STEP_MINUTES) {
    options.push(formatMinutesAsTime(minutes));
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

type AvailabilityEditorProps = {
  slots: AvailabilitySlotDraft[];
  onChange: (slots: AvailabilitySlotDraft[]) => void;
};

/** Simple add/remove editor for weekly availability slots: day + start + end selectors, no calendar, no drag and drop. */
function AvailabilityEditor({ slots, onChange }: AvailabilityEditorProps) {
  const [dayOfWeek, setDayOfWeek] = useState(WEEKDAY_OPTIONS[0]!.value);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('22:00');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddSlot = () => {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    const candidate: AvailabilitySlotDraft = { dayOfWeek, startMinutes, endMinutes };
    if (findConflictingSlotIndex(slots, candidate) !== null) {
      setFormError('Esa franja se superpone con otra que ya agregaste.');
      return;
    }

    setFormError(null);
    onChange([...slots, candidate]);
  };

  const handleRemoveSlot = (index: number) => {
    onChange(slots.filter((_, current) => current !== index));
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, mb: 2 }}>Disponibilidad semanal</Typography>

      {slots.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Todavía no agregaste franjas horarias.
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ mb: 3 }}>
          {slots.map((slot, index) => (
            <Stack
              key={`${slot.dayOfWeek}-${slot.startMinutes}-${slot.endMinutes}`}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}
            >
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{WEEKDAY_LABELS[slot.dayOfWeek]}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatMinutesAsTime(slot.startMinutes)} - {formatMinutesAsTime(slot.endMinutes)}
                </Typography>
              </Box>
              <IconButton aria-label={`Eliminar franja de ${WEEKDAY_LABELS[slot.dayOfWeek]} ${formatMinutesAsTime(slot.startMinutes)} a ${formatMinutesAsTime(slot.endMinutes)}`} onClick={() => handleRemoveSlot(index)}>
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}

      <Stack spacing={3} sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
        <TextField
          select
          label="Día"
          value={dayOfWeek}
          onChange={(event) => setDayOfWeek(Number(event.target.value))}
          slotProps={{ select: { native: true } }}
          fullWidth
        >
          {WEEKDAY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </TextField>

        <Stack direction="row" spacing={2}>
          <TextField
            select
            label="Desde"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            slotProps={{ select: { native: true } }}
            fullWidth
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </TextField>
          <TextField
            select
            label="Hasta"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            slotProps={{ select: { native: true } }}
            fullWidth
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </TextField>
        </Stack>

        {formError ? <Alert severity="error">{formError}</Alert> : null}

        <Button variant="outlined" onClick={handleAddSlot} sx={{ borderRadius: 999 }}>
          Agregar franja
        </Button>
      </Stack>
    </Box>
  );
}

export default AvailabilityEditor;
