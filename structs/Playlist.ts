import youtube, { Playlist as YoutubePlaylist } from "youtube-sr";
import { config } from "../utils/config";
import { Song } from "./Song";

const pattern = /^.*(youtu.be\/|list=)([^#\&\?]*).*/i;

export enum PlaylistPreset {
  Mashup = "playlist_mashup",
  DotaNight = "playlist_dota_night",
  Rap = "playlist_rap",
}

export class Playlist {
  public data: YoutubePlaylist;
  public videos: Song[];

  public constructor(playlist: YoutubePlaylist) {
    this.data = playlist;

    this.videos = this.data.videos
      .filter((video) => video.title != "Private video" && video.title != "Deleted video")
      .slice(0, config.MAX_PLAYLIST_SIZE - 1)
      .map((video) => {
        return new Song({
          title: video.title!,
          url: `https://youtube.com/watch?v=${video.id}`,
          duration: video.duration / 1000
        });
      });
  }

  public static async from(url: string = "", search: string = "") {
    const urlValid = pattern.test(url);
    let playlist;

    if (urlValid) {
      playlist = await youtube.getPlaylist(url);
    } else {
      const result = await youtube.searchOne(search, "playlist");

      playlist = await youtube.getPlaylist(result.url!);
    }

    return new this(playlist);
  }

  private static presets: Map<string, string> = new Map([
    [PlaylistPreset.DotaNight, "https://youtube.com/playlist?list=PLlNHQmUIaTEoeDhRjQzNnhbe5rvRpaasr"],
    [PlaylistPreset.Mashup, "https://youtube.com/playlist?list=PL-HyRIRUsinrpkW9X_RB-tNn3_sjfgU0l"],
    [PlaylistPreset.Rap, "https://youtube.com/playlist?list=PL_kK8EsrLe7l_six79UGYt_6OHaM0co66"],
  ]);

  public static getUrlFor(preset: PlaylistPreset): string | null {
    return Playlist.presets.get(preset) || null;
  }
}
