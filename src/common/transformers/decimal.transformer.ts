import { ValueTransformer } from 'typeorm';

/** numeric/decimal llega como texto desde pg; se convierte a número al leer. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
