import { useEffect, useState } from 'react';

/** Logo of a site/app group (`vault.groups[key].icon`), or its initials. */
export default function GroupLogo({
  icon,
  groupKey,
  name,
}: {
  icon?: string;
  groupKey: string;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [icon]);
  return (
    <span className="group-logo">
      {icon && !broken ? (
        <img src={icon} alt="" onError={() => setBroken(true)} />
      ) : (
        <span>{(name || groupKey).slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
