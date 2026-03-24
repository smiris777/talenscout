"use client";

import { useState, useMemo } from "react";
import { Azubi } from "@/types/database";
import { FilterBar } from "@/components/filter-bar";
import { AzubiGrid } from "@/components/azubi-grid";

interface AzubiDashboardProps {
  azubis: Azubi[];
}

export function AzubiDashboard({ azubis }: AzubiDashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [niveauFilter, setNiveauFilter] = useState("alle");
  const [artFilter, setArtFilter] = useState("alle");

  const filteredAzubis = useMemo(() => {
    return azubis.filter((azubi) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matchesName = azubi.name.toLowerCase().includes(q);
        const matchesZiel = azubi.ziel.toLowerCase().includes(q);
        const matchesEmail = azubi.email.toLowerCase().includes(q);
        if (!matchesName && !matchesZiel && !matchesEmail) return false;
      }

      // Status filter
      if (statusFilter !== "alle") {
        if (azubi.aktiv.toLowerCase() !== statusFilter.toLowerCase())
          return false;
      }

      // Niveau filter
      if (niveauFilter !== "alle") {
        if (azubi.deutschNiveau !== niveauFilter) return false;
      }

      // Art filter
      if (artFilter !== "alle") {
        if (azubi.art.toLowerCase() !== artFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [azubis, search, statusFilter, niveauFilter, artFilter]);

  // Extract unique values for filters
  const statusOptions = useMemo(() => {
    const statuses = [...new Set(azubis.map((a) => a.aktiv))].sort();
    return statuses;
  }, [azubis]);

  const niveauOptions = useMemo(() => {
    const niveaus = [
      ...new Set(azubis.map((a) => a.deutschNiveau).filter(Boolean)),
    ].sort();
    return niveaus;
  }, [azubis]);

  const artOptions = useMemo(() => {
    const arts = [
      ...new Set(azubis.map((a) => a.art).filter(Boolean)),
    ].sort();
    return arts;
  }, [azubis]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("alle");
    setNiveauFilter("alle");
    setArtFilter("alle");
  }

  const hasFilters = !!(
    search || statusFilter !== "alle" || niveauFilter !== "alle" || artFilter !== "alle"
  );

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={statusOptions}
        niveauFilter={niveauFilter}
        onNiveauChange={setNiveauFilter}
        niveauOptions={niveauOptions}
        artFilter={artFilter}
        onArtChange={setArtFilter}
        artOptions={artOptions}
        onClear={clearFilters}
        hasFilters={hasFilters}
        resultCount={filteredAzubis.length}
        totalCount={azubis.length}
      />
      <AzubiGrid azubis={filteredAzubis} />
    </div>
  );
}
