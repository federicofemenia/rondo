import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { AvatarUploadUrlResponseDto, UserDto, UserSexDto } from '@rondo/contracts';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import { ApiError, useApi } from './apiClient';
import PageFooter from './PageFooter';
import PushNotificationsSettings from './PushNotificationsSettings';

type EditProfilePageProps = {
  onBack?: () => void;
};

const MAX_BIOGRAPHY_LENGTH = 300;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
/** 'image/jpg' isn't a real MIME type but some browsers/OSes report it for .jpg files -- accepted client-side, normalized to 'image/jpeg' before asking the backend for an upload URL. */
const ACCEPTED_AVATAR_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function EditProfilePage({ onBack }: EditProfilePageProps) {
  const api = useApi();

  const [profile, setProfile] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sex, setSex] = useState<UserSexDto | null>(null);
  const [biography, setBiography] = useState('');

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get<{ data: UserDto }>('/api/v1/me');
        if (!cancelled) {
          setProfile(response.data);
          setSex(response.data.sex);
          setBiography(response.data.biography ?? '');
          setAvatarUrl(response.data.avatarUrl);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(describeError(caught, 'No pudimos cargar tu perfil. Reintentá más tarde.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setAvatarError(null);

    const contentType = ACCEPTED_AVATAR_TYPES[file.type];
    if (!contentType) {
      setAvatarError('La imagen debe ser JPG, PNG o WEBP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('La imagen no puede superar los 5 MB.');
      return;
    }

    setAvatarUploading(true);
    try {
      // 1) ask the backend for a short-lived presigned upload URL (Cloudflare
      // R2); 2) upload the file directly to R2, bypassing our own backend
      // entirely for the (potentially large) file bytes; 3) persist the
      // resulting public URL via the same profile PUT used for sex/biography
      // -- the backend independently verifies this exact URL was actually
      // issued for this user before accepting it (see users.controller.ts).
      const { uploadUrl, publicUrl } = await api.post<{ data: AvatarUploadUrlResponseDto }>('/api/v1/me/avatar/upload-url', { contentType }).then((r) => r.data);

      const uploadResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!uploadResponse.ok) {
        throw new Error('upload failed');
      }

      const response = await api.put<{ data: UserDto }>('/api/v1/me/profile', { sex, biography: biography.trim() || null, avatarUrl: publicUrl });
      setProfile(response.data);
      setAvatarUrl(response.data.avatarUrl);
    } catch (caught) {
      setAvatarError(describeError(caught, 'No pudimos actualizar tu foto. Reintentá.'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await api.put<{ data: UserDto }>('/api/v1/me/profile', {
        sex,
        biography: biography.trim() || null,
      });
      setProfile(response.data);
      setSaved(true);
    } catch (caught) {
      setSaveError(describeError(caught, 'No pudimos guardar tu perfil. Reintentá.'));
    } finally {
      setSaving(false);
    }
  };

  const initials = profile ? profile.displayName.slice(0, 2).toUpperCase() : '';

  return (
    <Box component="form" onSubmit={(event) => void handleSubmit(event)} sx={{ minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 4, pt: 5, pb: '120px' }}>
        <IconButton
          aria-label="Volver"
          onClick={onBack}
          sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>

        <Stack alignItems="center" sx={{ mb: 6 }}>
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Avatar
              src={avatarUrl ?? undefined}
              sx={{ width: 88, height: 88, fontSize: '2rem', bgcolor: 'primary.main', color: 'background.default' }}
            >
              {!avatarUrl ? initials : null}
            </Avatar>
            <IconButton
              component="label"
              aria-label="Cambiar foto de perfil"
              disabled={avatarUploading}
              sx={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                bgcolor: 'primary.main',
                color: 'background.default',
                border: '2px solid',
                borderColor: 'background.default',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {avatarUploading ? <CircularProgress size={16} color="inherit" /> : <CameraAltRoundedIcon fontSize="small" />}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                hidden
                onChange={(event) => void handleAvatarChange(event)}
              />
            </IconButton>
          </Box>
          <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
            Editar perfil
          </Typography>
          {profile ? (
            <Typography variant="body2" color="text.secondary">
              {profile.displayName}
              {profile.username ? ` • @${profile.username}` : ''}
            </Typography>
          ) : null}
        </Stack>

        {avatarError ? (
          <Alert severity="error" sx={{ mb: 4 }}>
            {avatarError}
          </Alert>
        ) : null}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : (
          <Stack spacing={4}>
            <FormControl>
              <FormLabel id="sex-radio-label">Sexo</FormLabel>
              <RadioGroup aria-labelledby="sex-radio-label" value={sex ?? ''} onChange={(event) => setSex(event.target.value as UserSexDto)}>
                <FormControlLabel value="MALE" control={<Radio />} label="Masculino" />
                <FormControlLabel value="FEMALE" control={<Radio />} label="Femenino" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Biografía"
              value={biography}
              onChange={(event) => setBiography(event.target.value.slice(0, MAX_BIOGRAPHY_LENGTH))}
              placeholder="Contá algo sobre vos: posición, frecuencia, estilo de juego."
              multiline
              minRows={3}
              fullWidth
              helperText={`${biography.length}/${MAX_BIOGRAPHY_LENGTH}`}
            />

            {saveError ? <Alert severity="error">{saveError}</Alert> : null}
            {saved ? (
              <Typography sx={{ color: 'primary.light', fontWeight: 600, textAlign: 'center' }}>Perfil actualizado.</Typography>
            ) : null}
          </Stack>
        )}

        <Box sx={{ mt: 6 }}>
          <PushNotificationsSettings />
        </Box>
      </Box>

      <PageFooter>
        <Button type="submit" fullWidth variant="contained" size="large" disabled={saving || loading} sx={{ borderRadius: 999 }}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </PageFooter>
    </Box>
  );
}

export default EditProfilePage;
