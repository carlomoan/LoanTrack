import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { District, Region, Street, Ward } from '@/types';

interface GeographyState {
  regions: Region[];
  districts: District[];
  wards: Ward[];
  streets: Street[];

  selectedRegion: Region | null;
  selectedDistrict: District | null;
  selectedWard: Ward | null;
  selectedStreet: Street | null;

  setRegions: (regions: Region[]) => void;
  setDistricts: (districts: District[]) => void;
  setWards: (wards: Ward[]) => void;
  setStreets: (streets: Street[]) => void;

  selectRegion: (region: Region | null) => void;
  selectDistrict: (district: District | null) => void;
  selectWard: (ward: Ward | null) => void;
  selectStreet: (street: Street | null) => void;

  clearSelections: () => void;
  clearBelow: (level: 'region' | 'district' | 'ward') => void;

  getSelectedGeographyIds: () => {
    region?: number;
    district?: number;
    ward?: number;
    street?: number;
  };

  getSelectedAddress: () => string;
}

export const useGeographyStore = create<GeographyState>()(
  persist(
    (set, get) => ({
      regions: [],
      districts: [],
      wards: [],
      streets: [],

      selectedRegion: null,
      selectedDistrict: null,
      selectedWard: null,
      selectedStreet: null,

      setRegions: (regions) => set({ regions }),
      setDistricts: (districts) => set({ districts }),
      setWards: (wards) => set({ wards }),
      setStreets: (streets) => set({ streets }),

      selectRegion: (region) =>
        set({
          selectedRegion: region,
          selectedDistrict: null,
          selectedWard: null,
          selectedStreet: null,
        }),

      selectDistrict: (district) =>
        set({
          selectedDistrict: district,
          selectedWard: null,
          selectedStreet: null,
        }),

      selectWard: (ward) =>
        set({
          selectedWard: ward,
          selectedStreet: null,
        }),

      selectStreet: (street) =>
        set({
          selectedStreet: street,
        }),

      clearSelections: () =>
        set({
          selectedRegion: null,
          selectedDistrict: null,
          selectedWard: null,
          selectedStreet: null,
        }),

      clearBelow: (level) =>
        set((state) => {
          if (level === 'region') {
            return {
              selectedDistrict: null,
              selectedWard: null,
              selectedStreet: null,
            };
          }

          if (level === 'district') {
            return {
              selectedWard: null,
              selectedStreet: null,
            };
          }

          if (level === 'ward') {
            return {
              selectedStreet: null,
            };
          }

          return state;
        }),

      getSelectedGeographyIds: () => {
        const state = get();

        return {
          region: state.selectedRegion?.id,
          district: state.selectedDistrict?.id,
          ward: state.selectedWard?.id,
          street: state.selectedStreet?.id,
        };
      },

      getSelectedAddress: () => {
        const state = get();

        const parts = [
          state.selectedStreet?.name,
          state.selectedWard?.name,
          state.selectedDistrict?.name,
          state.selectedRegion?.name,
        ].filter(Boolean);

        return parts.join(', ');
      },
    }),
    {
      name: 'loantrack-geography-storage',
      version: 1,
      partialize: (state) => ({
        selectedRegion: state.selectedRegion,
        selectedDistrict: state.selectedDistrict,
        selectedWard: state.selectedWard,
        selectedStreet: state.selectedStreet,
      }),
    }
  )
);
