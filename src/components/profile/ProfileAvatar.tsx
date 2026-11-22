import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProfileAvatarProps {
  name: string;
  path?: string | null;
  className?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ name, path, className = '' }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path || !supabase) {
      setUrl(null);
      return;
    }
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase!.storage.from('profile-avatars').createSignedUrl(path, 60 * 60);
      if (active) setUrl(error ? null : data.signedUrl);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 55 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [path]);

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ${className}`}>
      {url ? <img src={url} alt={`Аватар ${name}`} className="h-full w-full object-cover" /> : name.trim() ? name.trim().charAt(0).toUpperCase() : <UserRound className="h-1/2 w-1/2" />}
    </span>
  );
};
