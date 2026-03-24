"use client";

import { Azubi } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getStatusColor,
  getNiveauColor,
  getGDriveThumbnailUrl,
  getYouTubeEmbedUrl,
  getInitials,
} from "@/lib/utils/normalize";

interface AzubiDetailProps {
  azubi: Azubi;
  recentApplications: Array<{
    firmenname: string | null;
    email: string | null;
    name: string | null;
    telefonnummer: string | null;
    bewerbungsdatum: string | null;
    status: string | null;
    bereich: string | null;
    geschlecht: string | null;
  }>;
}

export function AzubiDetail({ azubi, recentApplications }: AzubiDetailProps) {
  const statusColor = getStatusColor(azubi.aktiv);
  const niveauColor = getNiveauColor(azubi.deutschNiveau);
  const photoUrl = getGDriveThumbnailUrl(azubi.fotoLink);
  const videoEmbedUrl = getYouTubeEmbedUrl(azubi.videoLink);
  const driveFolderUrl = azubi.driveFolderId
    ? `https://drive.google.com/drive/folders/${azubi.driveFolderId}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex-shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={azubi.name}
                  className="w-24 h-24 rounded-xl object-cover bg-gray-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={`w-24 h-24 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-3xl font-semibold ${photoUrl ? "hidden" : ""}`}
              >
                {getInitials(azubi.name)}
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{azubi.name}</h1>
              <p className="text-lg text-gray-600 mt-1">{azubi.ziel}</p>
              <p className="text-sm text-gray-500 mt-1">{azubi.email}</p>

              <div className="flex flex-wrap gap-2 mt-3">
                <Badge
                  variant="secondary"
                  className={`${statusColor.bg} ${statusColor.text} border-0`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusColor.dot} mr-1.5`} />
                  {azubi.aktiv}
                </Badge>
                {azubi.deutschNiveau && (
                  <Badge variant="secondary" className={`${niveauColor} border-0`}>
                    Deutsch: {azubi.deutschNiveau}
                  </Badge>
                )}
                <Badge variant="outline">{azubi.art}</Badge>
              </div>

              <div className="flex flex-wrap gap-6 mt-4 text-sm text-gray-500">
                <span>
                  <strong className="text-gray-900">
                    {azubi.bewerbungenCount.toLocaleString("de-DE")}
                  </strong>{" "}
                  Bewerbungen
                </span>
                {azubi.mitarbeiter && (
                  <span>
                    Betreuer: <strong className="text-gray-900">{azubi.mitarbeiter}</strong>
                  </span>
                )}
              </div>

              {driveFolderUrl && (
                <div className="mt-4">
                  <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      📁 Google Drive Ordner öffnen
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={videoEmbedUrl ? "video" : "profil"}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          {videoEmbedUrl && <TabsTrigger value="video">Video</TabsTrigger>}
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="lebenslauf">Lebenslauf</TabsTrigger>
          <TabsTrigger value="motivation">Motivation</TabsTrigger>
          {driveFolderUrl && <TabsTrigger value="dokumente">Dokumente</TabsTrigger>}
          <TabsTrigger value="bewerbungen">
            Bewerbungen ({azubi.bewerbungenCount.toLocaleString("de-DE")})
          </TabsTrigger>
        </TabsList>

        {videoEmbedUrl && (
          <TabsContent value="video">
            <Card>
              <CardHeader>
                <CardTitle>Bewerbungsvideo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={videoEmbedUrl}
                    title={`Bewerbungsvideo von ${azubi.name}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="profil">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent>
              {azubi.profil ? (
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {azubi.profil}
                </p>
              ) : (
                <p className="text-gray-400 italic">Kein Profil vorhanden.</p>
              )}
              {azubi.infos && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Zusätzliche Informationen
                  </h4>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {azubi.infos}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lebenslauf">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lebenslauf</CardTitle>
                {driveFolderUrl && (
                  <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      📄 PDF im Drive öffnen
                    </Button>
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {azubi.lebenslauf ? (
                <div className="text-gray-700 whitespace-pre-wrap leading-relaxed font-mono text-sm bg-gray-50 p-4 rounded-lg">
                  {azubi.lebenslauf}
                </div>
              ) : (
                <p className="text-gray-400 italic">
                  Kein Lebenslauf als Text vorhanden.
                  {driveFolderUrl && " Prüfe den Google Drive Ordner für die PDF-Version."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="motivation">
          <Card>
            <CardHeader>
              <CardTitle>Motivationsschreiben</CardTitle>
            </CardHeader>
            <CardContent>
              {azubi.motivationsschreiben ? (
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {azubi.motivationsschreiben}
                </p>
              ) : (
                <p className="text-gray-400 italic">
                  Kein Motivationsschreiben vorhanden.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {driveFolderUrl && (
          <TabsContent value="dokumente">
            <Card>
              <CardHeader>
                <CardTitle>Dokumente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Alle Dokumente dieses Kandidaten befinden sich im Google Drive Ordner.
                  Dort findest du Bewerbungsfoto, Lebenslauf (PDF), Zeugnisse und weitere Unterlagen.
                </p>
                <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer">
                  <Button>
                    📁 Alle Dokumente im Google Drive öffnen
                  </Button>
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="bewerbungen">
          <Card>
            <CardHeader>
              <CardTitle>Letzte Bewerbungen</CardTitle>
            </CardHeader>
            <CardContent>
              {recentApplications.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Firma</th>
                        <th className="pb-2 font-medium">Ansprechpartner</th>
                        <th className="pb-2 font-medium">E-Mail</th>
                        <th className="pb-2 font-medium">Telefon</th>
                        <th className="pb-2 font-medium">Datum</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentApplications.map((app, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2.5 text-gray-900 font-medium">
                            {app.firmenname || "-"}
                          </td>
                          <td className="py-2.5 text-gray-600">
                            {app.name || "-"}
                          </td>
                          <td className="py-2.5 text-gray-600">
                            {app.email ? (
                              <a
                                href={`mailto:${app.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {app.email}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-2.5 text-gray-600">
                            {app.telefonnummer || "-"}
                          </td>
                          <td className="py-2.5 text-gray-600 whitespace-nowrap">
                            {app.bewerbungsdatum
                              ? new Date(app.bewerbungsdatum).toLocaleDateString("de-DE")
                              : "-"}
                          </td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="text-xs">
                              {app.status || "Unbekannt"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 italic">Keine Bewerbungen vorhanden.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
