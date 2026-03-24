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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Suche nach Name, Beruf oder E-Mail..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => onStatusChange(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={niveauFilter} onValueChange={(val) => onNiveauChange(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Deutsch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Niveaus</SelectItem>
            {niveauOptions.map((niveau) => (
              <SelectItem key={niveau} value={niveau}>
                {niveau}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={artFilter} onValueChange={(val) => onArtChange(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Art" />
          </SelectTrigger>
          <SelectContent>
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
        <span className="text-sm text-gray-500">
          {hasFilters
            ? `${resultCount} von ${totalCount} Kandidaten`
            : `${totalCount} Kandidaten`}
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Filter zurücksetzen
          </Button>
        )}
      </div>
    </div>
  );
}
