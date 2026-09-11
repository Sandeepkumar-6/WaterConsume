# UI asset provenance and portability

All UI artwork, icons and fonts are served from this project. No CDN, Google Fonts request, remote stock image, personal filesystem path, or temporary URL is required at runtime.

| Asset                                   | Source and use                                                                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campus-water-conservation.svg`         | Original project-created vector illustration of an Indian institutional campus, tiled water point and hand closing a brass tap. Created for this portal; no third-party stock imagery. |
| `tap-awareness.svg`                     | Original project-created vector illustration of a brass tap and tiled wash basin. Used for short conservation reminders.                                                               |
| `client/public/favicon.svg`             | Original project-created drop-and-leaf favicon.                                                                                                                                        |
| `fonts/dm-sans-latin-wght-normal.woff2` | DM Sans variable font, obtained from `@fontsource-variable/dm-sans`. SIL Open Font License 1.1; complete license in `../../public/licenses/DM-Sans-LICENSE.txt`.                       |
| `fonts/manrope-latin-wght-normal.woff2` | Manrope variable font, obtained from `@fontsource-variable/manrope`. SIL Open Font License 1.1; complete license in `../../public/licenses/Manrope-LICENSE.txt`.                       |
| UI icons                                | `lucide-react`, bundled into JavaScript by Vite. ISC license in the installed package's `LICENSE` file. No icon service or CDN.                                                        |

SVG is intentional: these original flat illustrations remain sharp on mobile and desktop, total less than 8 KB, and need no raster image downloads. Meaningful image descriptions appear in their `alt` attributes; status badges include both icons and text.

The two Latin font files cover the portal's current English interface. They are checked into the source asset directory, so installing a font package again is not required to recover them. Browser/system fonts remain fallbacks for other scripts.

Vite copies or inlines imported assets when running `npm run build`. The `client/dist` output contains the complete static UI. Copy the entire source project for development, including the asset/license files and lockfile; install Node dependencies and configure MongoDB on the destination computer as described in the README.
