import type { ReactElement, SVGProps } from 'react';

type IconName =
  | 'cube'
  | 'layers'
  | 'lattice'
  | 'plane'
  | 'nodes'
  | 'tetra'
  | 'octa'
  | 'reset'
  | 'fullscreen'
  | 'help'
  | 'camera'
  | 'more'
  | 'home'
  | 'explode'
  | 'section'
  | 'rotate'
  | 'pause'
  | 'gear'
  | 'mouse';

const paths: Record<IconName, ReactElement> = {
  cube: <><path d="M12 2 4 6.5v11L12 22l8-4.5v-11L12 2Z" /><path d="M4 6.5 12 11l8-4.5" /><path d="M12 11v11" /></>,
  layers: <><path d="m12 3-8 4 8 4 8-4-8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 17 8 4 8-4" /></>,
  lattice: <><circle cx="7" cy="7" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M9 7h6M7 9v6M17 9v6M9 17h6" /></>,
  plane: <><path d="M4 17 12 4l8 13-8 4-8-4Z" /><path d="M8 14h8M12 4v17" /></>,
  nodes: <><circle cx="12" cy="12" r="2.5" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="m7 7 3 3m7-3-3 3m-7 7 3-3m7 3-3-3" /></>,
  tetra: <><path d="M12 3 4 19h16L12 3Z" /><path d="M12 3v16M4 19l8-5 8 5" /></>,
  octa: <><path d="M12 2 4 8v8l8 6 8-6V8l-8-6Z" /><path d="M4 8l8 6 8-6M12 14v8" /></>,
  reset: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  fullscreen: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 0 1 5.1 1.3c0 2-2.6 2.2-2.6 4" /><path d="M12 18h.01" /></>,
  camera: <><path d="M5 7h3l1.6-2h4.8L16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.2" /></>,
  more: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
  home: <><path d="M3 11 12 3l9 8" /><path d="M5.5 10.5V21h13V10.5" /><path d="M9 21v-6h6v6" /></>,
  explode: <><path d="M12 3v5m0 8v5M3 12h5m8 0h5" /><path d="m5.2 5.2 3.4 3.4m6.8 6.8 3.4 3.4m0-13.6-3.4 3.4m-6.8 6.8-3.4 3.4" /></>,
  section: <><path d="M6 4h12v16H6z" /><path d="m18 4-8 8 8 8" /><path d="M6 12h4" /></>,
  rotate: <><path d="M20 11a8 8 0 1 1-2.34-5.66" /><path d="M20 4v7h-7" /></>,
  pause: <><circle cx="12" cy="12" r="9" /><path d="M9.5 8v8M14.5 8v8" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.86-.34 1.7 1.7 0 0 0-1 1.56V20h-3v-.08a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.86.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3v-3h.08a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.86l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 8.3 5.4a1.7 1.7 0 0 0 1-1.56V3h3v.08a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.86-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 8.3a1.7 1.7 0 0 0 1.56 1H21v3h-.08a1.7 1.7 0 0 0-1.56 1Z" /></>,
  mouse: <><rect x="8" y="2.8" width="8" height="18.4" rx="4" /><path d="M12 6.5v4" /></>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
