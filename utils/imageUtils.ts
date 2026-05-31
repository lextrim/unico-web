/** Comprime una imagen al máximo de 1600px y 85% de calidad JPEG. */
export const compressImage = (file: File): Promise<File> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1600;
        let w = img.width, h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
        else if (h > MAX) { w *= MAX / h; h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
          'image/jpeg', 0.85
        );
      };
    };
  });

/**
 * Crea un blob URL y revoca el anterior si existía.
 * Devuelve la nueva URL para guardarla en el ref.
 */
export const createBlobUrl = (file: File, prevUrl: string | null): string => {
  if (prevUrl) URL.revokeObjectURL(prevUrl);
  return URL.createObjectURL(file);
};
