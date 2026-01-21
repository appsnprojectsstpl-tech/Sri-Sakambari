import type { HTMLAttributes } from 'react';
import Image from 'next/image';

export function Logo(props: HTMLAttributes<HTMLDivElement>) {
  // The SVG has been replaced by an Image component for the new logo.
  // The props like className are passed to the container div to maintain sizing.
  return (
    <div {...props} className={`relative ${props.className || 'h-10 w-10'}`}>
      <Image
        src="https://image2url.com/images/1765782592895-e331e0be-b91b-499e-abc2-ad62b01b50c3.png"
        alt="Sri Sakambari"
        fill
        className="object-cover rounded-full"
      />
    </div>
  );
}
