const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="36" r="22" fill="#A8E6CF"/><circle cx="14" cy="20" r="8" fill="#8DD4B8"/><circle cx="50" cy="20" r="8" fill="#8DD4B8"/><circle cx="14" cy="20" r="4" fill="#7BC4A8"/><circle cx="50" cy="20" r="4" fill="#7BC4A8"/><circle cx="24" cy="34" r="3" fill="#333"/><circle cx="40" cy="34" r="3" fill="#333"/><circle cx="25" cy="33" r="1.2" fill="#fff"/><circle cx="41" cy="33" r="1.2" fill="#fff"/><ellipse cx="32" cy="41" rx="4" ry="3" fill="#7BC4A8"/><ellipse cx="32" cy="40" rx="2" ry="1.2" fill="#333"/><path d="M27 46 Q32 50 37 46" stroke="#333" stroke-width="1.5" fill="none"/></svg>`;

interface AvatarProps {
  avatarUrl?: string | null;
  size?: number;
}

export default function Avatar({ avatarUrl, size = 32 }: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#A8E6CF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: DEFAULT_AVATAR_SVG }}
    />
  );
}
