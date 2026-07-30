import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { formatMinutesAsTime } from './scheduleFormat';

const STEP_MINUTES = 30;

type ExactStartTimeInputProps = {
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
};

/**
 * Optional exact-start-time picker, scoped to the mandatory availability
 * window: the day and franja are always required upstream, this only ever
 * narrows down to a specific minute-of-day within that franja (or stays
 * unset, leaving the match "horario a confirmar").
 */
function ExactStartTimeInput({ availabilityStartMinutes, availabilityEndMinutes, value, onChange, label = 'Horario exacto (opcional)' }: ExactStartTimeInputProps) {
  const options = useMemo(() => {
    const result: number[] = [];
    for (let minutes = availabilityStartMinutes; minutes < availabilityEndMinutes; minutes += STEP_MINUTES) {
      result.push(minutes);
    }
    return result;
  }, [availabilityStartMinutes, availabilityEndMinutes]);

  const enabled = value !== null;

  return (
    <Box sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {enabled && value !== null ? formatMinutesAsTime(value) : 'Sin definir'}
          </Typography>
        </Box>
        <Switch
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? (options[0] ?? availabilityStartMinutes) : null)}
          inputProps={{ 'aria-label': label }}
          disabled={options.length === 0}
        />
      </Stack>
      {enabled ? (
        <TextField
          select
          label="Hora de inicio"
          value={value ?? options[0] ?? availabilityStartMinutes}
          onChange={(event) => onChange(Number(event.target.value))}
          slotProps={{ select: { native: true } }}
          fullWidth
          sx={{ mt: 3 }}
        >
          {options.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatMinutesAsTime(minutes)}
            </option>
          ))}
        </TextField>
      ) : null}
    </Box>
  );
}

export default ExactStartTimeInput;
