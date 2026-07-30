import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

export const MIN_AVAILABILITY_HOUR = 10;
export const MAX_AVAILABILITY_HOUR = 24;
export const DEFAULT_AVAILABILITY_RANGE: [number, number] = [13, 19];

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatHourRange([start, end]: [number, number]): string {
  return `${formatHour(start)} - ${formatHour(end)}`;
}

type TimeRangeInputProps = {
  value: [number, number];
  onChange: (value: [number, number]) => void;
  label?: string;
};

/** Mandatory availability-window picker: the organizer must always choose a franja, even without an exact time. */
function TimeRangeInput({ value, onChange, label = 'Franja horaria disponible' }: TimeRangeInputProps) {
  return (
    <Box sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary">
        {formatHourRange(value)}
      </Typography>
      <Slider
        value={value}
        onChange={(_event, newValue) => onChange(newValue as [number, number])}
        min={MIN_AVAILABILITY_HOUR}
        max={MAX_AVAILABILITY_HOUR}
        step={1}
        marks
        valueLabelDisplay="auto"
        valueLabelFormat={formatHour}
        disableSwap
        getAriaLabel={(index) => (index === 0 ? 'Desde' : 'Hasta')}
        sx={{ mt: 4, color: 'primary.main' }}
      />
    </Box>
  );
}

export default TimeRangeInput;
