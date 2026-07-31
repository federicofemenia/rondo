import { useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import SportsSoccerRoundedIcon from '@mui/icons-material/SportsSoccerRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import logoIcon from './assets/logo-icon.png';

type AppHeaderProps = {
  onEditProfile?: () => void;
  onEditSportProfile?: () => void;
  onLogout?: () => void;
};

function AppHeader({ onEditProfile, onEditSportProfile, onLogout }: AppHeaderProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);

  const closeMenu = () => setMenuAnchor(null);

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
          <IconButton aria-label="Notificaciones" sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
            <Badge color="warning" variant="dot">
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
    </Box>
  );
}

export default AppHeader;
