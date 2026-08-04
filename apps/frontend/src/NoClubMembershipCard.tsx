import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';

type NoClubMembershipCardProps = {
  title?: string;
  description?: string;
  /**
   * The current club-membership model only has ACTIVE/INACTIVE (no PENDING
   * request state yet), so no caller sets this to true today. The prop
   * exists so the card is ready for that once a request flow is built.
   */
  hasPendingRequest?: boolean;
};

/**
 * Informational (not error) state shown wherever club-specific content
 * (novedades, canchas, reservas) would otherwise go for a user with no
 * ACTIVE club membership. "Buscar club" is a placeholder for a future slice
 * -- it never opens a real search here.
 */
function NoClubMembershipCard({
  title = 'Clubes',
  description = 'Todavía no estás asociado a ningún club. Podés seguir creando partidos con "Sede a definir" u "Otro". Cuando te asocies a un club vas a poder acceder a sus canchas, novedades y reservas.',
  hasPendingRequest = false,
}: NoClubMembershipCardProps) {
  return (
    <Card variant="outlined" sx={{ p: 4, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={3} alignItems="flex-start">
        <Avatar sx={{ bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <PlaceRoundedIcon sx={{ color: 'info.main' }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {hasPendingRequest ? (
            <Typography variant="body2" sx={{ color: 'info.main', fontWeight: 700, mt: 2 }}>
              Tenés una solicitud de asociación pendiente.
            </Typography>
          ) : null}
        </Box>
      </Stack>
      <Button variant="outlined" fullWidth disabled sx={{ mt: 3 }}>
        Buscar club (Próximamente)
      </Button>
    </Card>
  );
}

export default NoClubMembershipCard;
