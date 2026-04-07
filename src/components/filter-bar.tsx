"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusOptions: string[];
  niveauFilter: string;
  onNiveauChange: (value: string) => void;
  niveauOptions: string[];
  artFilter: string;
  onArtChange: (value: string) => void;
  artOptions: string[];
  onClear: () => void;
  hasFilters: boolean;
  resultCount: number;
  totalCount: number;
}

export function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOptions,
  niveauFilter,
  onNiveauChange,
  niveauOptions,
  artFilter,
  onArtChange,
  artOptions,
  onClear,
  hasFilters,
  resultCount,
  totalCount,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1">
          <Input
            placeholder="Suche nach Name, Beruf oder E-Mail..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 rounded-xl bg-white/80 border-gray-200/60 text-sm placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => onStatusChange(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl bg-white/80 border-gray-200/60 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200/60 shadow-lg shadow-black/[0.08]">
            <SelectItem value="alle">Alle Status</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={niveauFilter} onValueChange={(val) => onNiveauChange(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-xl bg-white/80 border-gray-200/60 text-sm">
            <SelectValue placeholder="Deutsch" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200/60 shadow-lg shadow-black/[0.08]">
            <SelectItem value="alle">Alle Niveaus</SelectItem>
            {niveauOptions.map((niveau) => (
              <SelectItem key={niveau} value={niveau}>
                {niveau}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={artFilter} onValueChange={(val) => onArtChange(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-xl bg-white/80 border-gray-200/60 text-sm">
            <SelectValue placeholder="Art" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-gray-200/60 shadow-lg shadow-black/[0.08]">
            <SelectItem value="alle">Alle Arten</SelectItem>
            {artOptions.map((art) => (
              <SelectItem key={art} value={art}>
                {art}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">
          {hasFilters
            ? `${resultCount} von ${totalCount} Kandidaten`
            : `${totalCount} Kandidaten`}
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-xs text-gray-400 hover:text-[#1d1d1f] rounded-full">
            Filter zurücksetzen
          </Button>
        )}
      </div>
    </div>
  );
}
