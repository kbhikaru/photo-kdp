import type { Photo, Property } from '../types';

export function filterPhotos(photos: Photo[], properties: Property[], query: string): Photo[] {
  const q = query.trim().toLowerCase();
  if (!q) return photos;
  const propertyNameById = new Map(properties.map((p) => [p.id, p.name.toLowerCase()]));
  return photos.filter((photo) => {
    const propertyName = propertyNameById.get(photo.propertyId) ?? '';
    return (
      propertyName.includes(q) ||
      photo.description.toLowerCase().includes(q) ||
      photo.fileName.toLowerCase().includes(q) ||
      photo.takenAt.includes(q)
    );
  });
}
