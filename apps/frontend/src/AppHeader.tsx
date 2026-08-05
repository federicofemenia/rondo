import { useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import logoIcon from './assets/logo-icon.png';
import type { PendingAction } from './types';

type AppHeaderProps = {
  onEditProfile?: () => void;
  onEditSportProfile?: () => void;
  onLogout?: () => void;
  pendingActions?: PendingAction[];
  showAdmin?: boolean;
  onOpenAdmin?: () => void;
};

function AppHeader({ onEditProfile, onEditSportProfile, onLogout, pendingActions = [], showAdmin = false, onOpenAdmin }: AppHeaderProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);
  const closeMenu = () => setMenuAnchor(null);

  const [notificationsAnchor, setNotificationsAnchor] = useState<HTMLElement | null>(null);
  const notificationsOpen = Boolean(notificationsAnchor);
  const closeNotifications = () => setNotificationsAnchor(null);
  const pendingActionsCount = pendingActions.length;

  return (
    <Box component="header" sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          maxWidth: 480,
          mx: 'auto',
          px: 4,
          py: 3,
        }}
      >
        <Box />
        <Box component="img" src={logoIcon} alt="Rondo" sx={{ height: 36, width: 36, objectFit: 'contain', justifySelf: 'center' }} />
        <Stack direction="row" spacing={1.5} sx={{ justifySelf: 'end' }}>
          <IconButton
            aria-label={
              pendingActionsCount > 0
                ? `Notificaciones (${pendingActionsCount} ${pendingActionsCount === 1 ? 'pendiente' : 'pendientes'})`
                : 'Notificaciones'
            }
            aria-haspopup="true"
            aria-expanded={notificationsOpen ? 'true' : undefined}
            onClick={(event) => setNotificationsAnchor(event.currentTarget)}
            sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}
          >
            <Badge color="error" variant="dot" invisible={pendingActionsCount === 0}>
              <NotificationsNoneRoundedIcon />
            </Badge>
          </IconButton>
          <IconButton
            aria-label="Menú"
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Stack>
      </Box>

      <Menu anchorEl={menuAnchor} open={menuOpen} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            closeMenu();
            onEditProfile?.();
          }}
        >
          <ListItemIcon>
            <PersonOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          Editar perfil
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            onEditSportProfile?.();
          }}
        >
          <ListItemIcon>
            <SportsSoccerRoundedIcon fontSize="small" />
          </ListItemIcon>
          Perfil deportivo
        </MenuItem>
        {showAdmin ? (
          <MenuItem
            onClick={() => {
              closeMenu();
              onOpenAdmin?.();
            }}
          >
            <ListItemIcon>
              <AdminPanelSettingsRoundedIcon fontSize="small" />
            </ListItemIcon>
            Administración
          </MenuItem>
        ) : null}
        <Divider />
        <MenuItem
          onClick={() => {
            closeMenu();
            onLogout?.();
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <Box component="span" sx={{ color: 'error.main' }}>
            Cerrar sesión
          </Box>
        </MenuItem>
      </Menu>

      <Popover
        anchorEl={notificationsAnchor}
        open={notificationsOpen}
        onClose={closeNotifications}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 340, maxWidth: '90vw', maxHeight: 420, p: 3 } } }}
      >
        <Typography sx={{ fontWeight: 800, mb: pendingActionsCount > 0 ? 3 : 0 }}>Acciones pendientes</Typography>
        {pendingActionsCount === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No tenés acciones pendientes.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {pendingActions.map((action) => (
              <Card key={action.id} variant="outlined" sx={{ borderColor: 'divider', bgcolor: 'background.default' }}>
                <CardActionArea
                  onClick={() => {
                    closeNotifications();
                    action.onClick();
                  }}
                  sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'center' }}
                >
                  <WarningAmberRoundedIcon sx={{ color: 'warning.main', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {action.label}
                    </Typography>
                    {action.description ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {action.description}
                      </Typography>
                    ) : null}
                  </Box>
                  <ChevronRightRoundedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )}
      </Popover>
    </Box>
  );
}

export default AppHeader;
