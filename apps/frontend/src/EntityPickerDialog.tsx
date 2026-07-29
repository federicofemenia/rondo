import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

export type PickerItem = {
  id: string;
  title: string;
  subtitle: string;
};

type EntityPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  items: PickerItem[];
  emptyLabel: string;
  onSelect: (id: string) => void;
};

function EntityPickerDialog({ open, onClose, title, items, emptyLabel, onSelect }: EntityPickerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        {title}
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {items.length === 0 ? (
          <Typography color="text.secondary">{emptyLabel}</Typography>
        ) : (
          <Stack spacing={2}>
            {items.map((item) => (
              <Button
                key={item.id}
                onClick={() => onSelect(item.id)}
                sx={{
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  p: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '16px',
                  color: 'text.primary',
                }}
                endIcon={<ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.subtitle}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EntityPickerDialog;
