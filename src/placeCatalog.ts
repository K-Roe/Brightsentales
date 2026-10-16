export type Place = {
  id: string;
  name: string;
  background: string | null;
  protected: boolean;
  artworkAvailable: boolean;
};

export const PLACES: readonly Place[] = [
  { id: 'living-room', name: 'Living Room', background: '/art/living-room.png', protected: true, artworkAvailable: true },
  { id: 'bedroom', name: 'Bedroom', background: null, protected: false, artworkAvailable: false },
  { id: 'garden', name: 'Garden', background: null, protected: false, artworkAvailable: false },
];
