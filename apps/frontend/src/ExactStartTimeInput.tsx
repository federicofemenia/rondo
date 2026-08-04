import { useMemo } from 'react';
import TextField from '@mui/material/TextField';
import { formatMinutesAsTime } from './scheduleFormat';

const STEP_MINUTES = 30;

type ExactStartTimeInputProps = {
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  value: number | null;
  onChange: (value: number) => void;
  label?: string;
};

/**
 * Plain slot picker within the availability window. Whether an exact time
 * applies at all is decided one level up (the "¿Tenés un horario exacto?"
 * question) -- this component only renders once that answer is "sí", so it
 * has no enabled/disabled state of its own.
 */
function ExactStartTimeInput({ availabilityStartMinutes, availabilityEndMinutes, value, onChange, label = 'Horario exacto' }: ExactStartTimeInputProps) {
  const options = useMemo(() => {
    const result: number[] = [];
    for (let minutes = availabilityStartMinutes; minutes < availabilityEndMinutes; minutes += STEP_MINUTES) {
      result.push(minutes);
    }
    return result;
  }, [availabilityStartMinutes, availabilityEndMinutes]);

  return (
    <TextField
      select
      label={label}
      value={value ?? options[0] ?? availabilityStartMinutes}
      onChange={(event) => onChange(Number(event.target.value))}
      slotProps={{ select: { native: true } }}
      fullWidth
    >
      {options.map((minutes) => (
        <option key={minutes} value={minutes}>
          {formatMinutesAsTime(minutes)}
        </option>
      ))}
    </TextField>
  );
}

export default ExactStartTimeInput;
