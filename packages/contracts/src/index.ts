export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

export interface UserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClubMembershipRoleDto = 'MEMBER' | 'CLUB_ADMIN';
export type ClubMembershipStatusDto = 'ACTIVE' | 'INACTIVE';

export interface UserClubDto {
  id: string;
  code: string;
  name: string;
  role: ClubMembershipRoleDto;
  status: ClubMembershipStatusDto;
  isFavorite: boolean;
}

export interface SportModalityDto {
  id: string;
  code: string;
  name: string;
  playersCount: number;
  displayOrder: number;
}

export interface SportDto {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  modalities: SportModalityDto[];
}
