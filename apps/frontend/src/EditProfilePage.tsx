import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PageFooter from './PageFooter';

type EditProfilePageProps = {
  onBack?: () => void;
};

function EditProfilePage({ onBack }: EditProfilePageProps) {
  const [firstName, setFirstName] = useState('Federico');
  const [lastName, setLastName] = useState('Femenia');
  const [email, setEmail] = useState('femenia.f@gmail.com');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: '120px' }}>
        <IconButton
          aria-label="Volver"
          onClick={onBack}
          sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>

        <Stack alignItems="center" sx={{ mb: 6 }}>
          <Avatar sx={{ width: 88, height: 88, fontSize: '2rem', bgcolor: 'primary.main', color: 'background.default', mb: 2 }}>
            {firstName.charAt(0)}
            {lastName.charAt(0)}
          </Avatar>
          <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
            Editar perfil
          </Typography>
        </Stack>

        <Stack spacing={4}>
          <Stack direction="row" spacing={3}>
            <TextField label="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} fullWidth />
            <TextField label="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} fullWidth />
          </Stack>
          <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth />
          <TextField
            label="Teléfono"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+54 9 11 1234 5678"
            fullWidth
          />
          <TextField
            label="Biografía"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Contá algo sobre vos: posición, frecuencia, estilo de juego."
            multiline
            minRows={3}
            fullWidth
          />

          {saved ? (
            <Typography sx={{ color: 'primary.light', fontWeight: 600, textAlign: 'center' }}>Perfil actualizado.</Typography>
          ) : null}
        </Stack>
      </Box>

      <PageFooter>
        <Button type="submit" fullWidth variant="contained" size="large" sx={{ borderRadius: 999 }}>
          Guardar cambios
        </Button>
      </PageFooter>
    </Box>
  );
}

export default EditProfilePage;
