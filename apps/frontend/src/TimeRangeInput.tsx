import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

const MIN_HOUR = 10;
const MAX_HOUR = 24;
const DEFAULT_RANGE: [number, number] = [13, 19];

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function parseTimeRange(value: string | null): [number, number] {
  if (!value) {
    return DEFAULT_RANGE;
  }
  const [startLabel, endLabel] = value.split(' - ');
  const start = Number(startLabel?.split(':')[0]);
  const end = Number(endLabel?.split(':')[0]);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return [start, end];
  }
  return DEFAULT_RANGE;
}

export function formatTimeRange([start, end]: [number, number]): string {
  return `${formatHour(start)} - ${formatHour(end)}`;
}

type TimeRangeInputProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
};

function TimeRangeInput({ value, onChange, label = 'Horario estimado' }: TimeRangeInputProps) {
  const enabled = value !== null;
  const range = useMemo(() => parseTimeRange(value), [value]);

  return (
    <Box sx={{ p: 3, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {enabled ? formatTimeRange(range) : 'Sin definir'}
          </Typography>
        </Box>
        <Switch
          checked={enabled}
          onChange={(event) => onChange(event.target.checked ? formatTimeRange(range) : null)}
          inputProps={{ 'aria-label': label }}
        />
      </Stack>
      {enabled ? (
        <Slider
          value={range}
          onChange={(_event, newValue) => onChange(formatTimeRange(newValue as [number, number]))}
          min={MIN_HOUR}
          max={MAX_HOUR}
          step={1}
          marks
          valueLabelDisplay="auto"
          valueLabelFormat={formatHour}
          disableSwap
          getAriaLabel={(index) => (index === 0 ? 'Desde' : 'Hasta')}
          sx={{ mt: 4, color: 'primary.main' }}
        />
      ) : null}
    </Box>
  );
}

export default TimeRangeInput;
