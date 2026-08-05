import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { AdminClubDetailDto, ClubAdminUserDto, CourtAdminDto, UpdateClubInputDto } from '@rondo/contracts';
import { ApiError, useApi } from './apiClient';
import AssignAdminDialog from './AssignAdminDialog';
import ConfirmDialog from './ConfirmDialog';
import CourtFormDialog from './CourtFormDialog';

type ClubAdminTab = 'resumen' | 'canchas' | 'administradores';

type ClubAdminPageProps = {
  clubId: string;
  onBack?: () => void;
};

const ADMIN_CONTAINER_MAX_WIDTH = { xs: '100%', sm: 640, md: 900, lg: 1200 };

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function ClubAdminPage({ clubId, onBack }: ClubAdminPageProps) {
  const api = useApi();
  const [tab, setTab] = useState<ClubAdminTab>('resumen');

  const [club, setClub] = useState<AdminClubDetailDto | null>(null);
  const [courts, setCourts] = useState<CourtAdminDto[]>([]);
  const [admins, setAdmins] = useState<ClubAdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingSummary, setEditingSummary] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [deactivateClubOpen, setDeactivateClubOpen] = useState(false);

  const [courtDialogOpen, setCourtDialogOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<CourtAdminDto | null>(null);
  const [courtToToggle, setCourtToToggle] = useState<CourtAdminDto | null>(null);

  const [assignAdminOpen, setAssignAdminOpen] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<ClubAdminUserDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const load = async () => {
      try {
        const [clubResponse, courtsResponse, adminsResponse] = await Promise.all([
          api.get<{ data: AdminClubDetailDto }>(`/api/v1/admin/clubs/${clubId}`),
          api.get<{ data: CourtAdminDto[] }>(`/api/v1/admin/clubs/${clubId}/courts`),
          api.get<{ data: ClubAdminUserDto[] }>(`/api/v1/admin/clubs/${clubId}/admins`),
        ]);
        if (!cancelled) {
          setClub(clubResponse.data);
          setCourts(courtsResponse.data);
          setAdmins(adminsResponse.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(describeError(caught, 'No pudimos cargar este club. Reintentá más tarde.'));
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
  }, [clubId]);

  const isSuperadmin = club?.myRole === 'SUPERADMIN';

  const startEditingSummary = () => {
    if (!club) {
      return;
    }
    setNameDraft(club.name);
    setDescriptionDraft(club.description ?? '');
    setCityDraft(club.city ?? '');
    setAddressDraft(club.address ?? '');
    setSummaryError(null);
    setEditingSummary(true);
  };

  const handleSaveSummary = async () => {
    setSavingSummary(true);
    setSummaryError(null);
    try {
      const input: UpdateClubInputDto = {
        description: descriptionDraft.trim() || null,
        city: cityDraft.trim() || null,
        address: addressDraft.trim() || null,
        ...(isSuperadmin ? { name: nameDraft.trim() } : {}),
      };
      const response = await api.put<{ data: AdminClubDetailDto }>(`/api/v1/admin/clubs/${clubId}`, input);
      setClub(response.data);
      setEditingSummary(false);
    } catch (caught) {
      setSummaryError(describeError(caught, 'No pudimos guardar los cambios. Reintentá.'));
    } finally {
      setSavingSummary(false);
    }
  };

  const handleToggleClubActive = async () => {
    if (!club) {
      return;
    }
    const response = await api.put<{ data: AdminClubDetailDto }>(`/api/v1/admin/clubs/${clubId}`, { isActive: !club.isActive });
    setClub(response.data);
    setDeactivateClubOpen(false);
  };

  const handleCourtSaved = (court: CourtAdminDto) => {
    setCourts((current) => {
      const exists = current.some((existing) => existing.id === court.id);
      return exists ? current.map((existing) => (existing.id === court.id ? court : existing)) : [...current, court];
    });
    setCourtDialogOpen(false);
    setEditingCourt(null);
  };

  const handleToggleCourtActive = async () => {
    if (!courtToToggle) {
      return;
    }
    const response = await api.put<{ data: CourtAdminDto }>(`/api/v1/admin/clubs/${clubId}/courts/${courtToToggle.id}`, {
      isActive: !courtToToggle.isActive,
    });
    setCourts((current) => current.map((court) => (court.id === response.data.id ? response.data : court)));
    setCourtToToggle(null);
  };

  const handleAdminAssigned = (updatedAdmins: ClubAdminUserDto[]) => {
    setAdmins(updatedAdmins);
  };

  const handleRemoveAdmin = async () => {
    if (!adminToRemove) {
      return;
    }
    const response = await api.delete<{ data: ClubAdminUserDto[] }>(`/api/v1/admin/clubs/${clubId}/admins/${adminToRemove.id}`);
    setAdmins(response.data);
    setAdminToRemove(null);
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: ADMIN_CONTAINER_MAX_WIDTH, mx: 'auto', px: 4, pt: 12 }}>
        <Stack alignItems="center">
          <CircularProgress />
        </Stack>
      </Box>
    );
  }

  if (loadError || !club) {
    return (
      <Box sx={{ maxWidth: ADMIN_CONTAINER_MAX_WIDTH, mx: 'auto', px: 4, pt: 5 }}>
        <IconButton aria-label="Volver" onClick={onBack} sx={{ mb: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Alert severity="error">{loadError ?? 'No pudimos cargar este club.'}</Alert>
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ maxWidth: ADMIN_CONTAINER_MAX_WIDTH, mx: 'auto', px: 4, pt: 5, pb: 12 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
        <IconButton aria-label="Volver" onClick={onBack} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '1.5rem' }}>
            {club.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administración del club
          </Typography>
        </Box>
      </Stack>

      <Tabs value={tab} onChange={(_event, value: ClubAdminTab) => setTab(value)} sx={{ minHeight: 0, mb: 4 }}>
        <Tab value="resumen" label="Resumen" sx={{ minHeight: 0 }} />
        <Tab value="canchas" label="Canchas" sx={{ minHeight: 0 }} />
        <Tab value="administradores" label="Administradores" sx={{ minHeight: 0 }} />
      </Tabs>

      {tab === 'resumen' ? (
        <Card variant="outlined" sx={{ p: 5, borderColor: 'divider' }}>
          {editingSummary ? (
            <Stack spacing={3}>
              <TextField label="Nombre" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={!isSuperadmin} fullWidth />
              <TextField
                label="Descripción"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <TextField label="Localidad" value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} fullWidth />
              <TextField label="Dirección" value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} fullWidth />
              {summaryError ? <Alert severity="error">{summaryError}</Alert> : null}
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={() => setEditingSummary(false)} disabled={savingSummary}>
                  Cancelar
                </Button>
                <Button variant="contained" onClick={() => void handleSaveSummary()} disabled={savingSummary}>
                  {savingSummary ? 'Guardando…' : 'Guardar'}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={4}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={2}>
                <Chip
                  label={club.isActive ? 'Activo' : 'Inactivo'}
                  sx={club.isActive ? { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 } : { bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700 }}
                />
                <Button variant="outlined" onClick={startEditingSummary}>
                  Editar
                </Button>
              </Stack>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Descripción
                </Typography>
                <Typography>{club.description || 'Sin descripción.'}</Typography>
              </Box>
              <Stack direction="row" spacing={6} flexWrap="wrap" useFlexGap>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Localidad
                  </Typography>
                  <Typography>{club.city || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Dirección
                  </Typography>
                  <Typography>{club.address || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Canchas activas
                  </Typography>
                  <Typography>{club.activeCourtsCount}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Administradores activos
                  </Typography>
                  <Typography>{club.activeAdminsCount}</Typography>
                </Box>
              </Stack>

              {isSuperadmin ? (
                <Box>
                  <Button variant="outlined" color={club.isActive ? 'error' : 'primary'} onClick={() => setDeactivateClubOpen(true)}>
                    {club.isActive ? 'Desactivar club' : 'Activar club'}
                  </Button>
                </Box>
              ) : null}
            </Stack>
          )}
        </Card>
      ) : null}

      {tab === 'canchas' ? (
        <Box>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => {
                setEditingCourt(null);
                setCourtDialogOpen(true);
              }}
            >
              Nueva cancha
            </Button>
          </Stack>

          {courts.length === 0 ? (
            <Card variant="outlined" sx={{ p: 5, borderColor: 'divider', textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                Este club todavía no tiene canchas configuradas.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setEditingCourt(null);
                  setCourtDialogOpen(true);
                }}
              >
                Agregar cancha
              </Button>
            </Card>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              {courts.map((court) => (
                <Card key={court.id} variant="outlined" sx={{ p: 4, borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{court.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {court.sportName} • {court.modalityName}
                      </Typography>
                    </Box>
                    <Chip
                      label={court.isActive ? 'Activa' : 'Inactiva'}
                      size="small"
                      sx={court.isActive ? { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light', fontWeight: 700 } : { bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700 }}
                    />
                  </Stack>
                  {court.description ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {court.description}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={2}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEditingCourt(court);
                        setCourtDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color={court.isActive ? 'error' : 'primary'}
                      onClick={() => (court.isActive ? setCourtToToggle(court) : void handleToggleCourtActive())}
                    >
                      {court.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      ) : null}

      {tab === 'administradores' ? (
        <Box>
          {isSuperadmin ? (
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setAssignAdminOpen(true)}>
                Agregar administrador
              </Button>
            </Stack>
          ) : null}

          {admins.length === 0 ? (
            <Typography color="text.secondary">Este club todavía no tiene administradores.</Typography>
          ) : (
            <Stack spacing={2}>
              {admins.map((admin) => (
                <Card key={admin.id} variant="outlined" sx={{ p: 3, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar src={admin.avatarUrl ?? undefined}>{admin.displayName.charAt(0).toUpperCase()}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {admin.displayName}
                      </Typography>
                      {admin.username ? (
                        <Typography variant="caption" color="text.secondary">
                          @{admin.username}
                        </Typography>
                      ) : null}
                    </Box>
                    {isSuperadmin ? (
                      <IconButton aria-label={`Quitar a ${admin.displayName} como administrador`} onClick={() => setAdminToRemove(admin)}>
                        <DeleteOutlineRoundedIcon sx={{ color: 'error.main' }} />
                      </IconButton>
                    ) : null}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      ) : null}

      <ConfirmDialog
        open={deactivateClubOpen}
        title={club.isActive ? 'Desactivar club' : 'Activar club'}
        description={
          club.isActive
            ? 'El club dejará de aparecer en la búsqueda y no se podrán crear nuevas reservas. Las canchas y administradores no se eliminan.'
            : 'El club volverá a aparecer en la búsqueda y se podrán crear nuevas reservas.'
        }
        confirmLabel={club.isActive ? 'Desactivar' : 'Activar'}
        destructive={club.isActive}
        onCancel={() => setDeactivateClubOpen(false)}
        onConfirm={handleToggleClubActive}
      />

      <ConfirmDialog
        open={courtToToggle !== null}
        title="Desactivar cancha"
        description="La cancha dejará de estar disponible para nuevas reservas, pero se conserva su historial."
        confirmLabel="Desactivar"
        destructive
        onCancel={() => setCourtToToggle(null)}
        onConfirm={handleToggleCourtActive}
      />

      <ConfirmDialog
        open={adminToRemove !== null}
        title="Quitar administrador"
        description={adminToRemove ? `${adminToRemove.displayName} dejará de administrar este club.` : ''}
        confirmLabel="Quitar"
        destructive
        onCancel={() => setAdminToRemove(null)}
        onConfirm={handleRemoveAdmin}
      />

      <CourtFormDialog
        open={courtDialogOpen}
        clubId={clubId}
        court={editingCourt}
        onClose={() => {
          setCourtDialogOpen(false);
          setEditingCourt(null);
        }}
        onSaved={handleCourtSaved}
      />

      <AssignAdminDialog open={assignAdminOpen} clubId={clubId} onClose={() => setAssignAdminOpen(false)} onAssigned={handleAdminAssigned} />
    </Box>
  );
}

export default ClubAdminPage;
