// Logo Component for W.A.T.C.H. - Circular Green Icon with Truck
import './LeafLogo.css';

interface LeafLogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function LeafLogo({ size = 'medium', className = '' }: LeafLogoProps) {
  const sizeClasses = {
    small: 'leaf-logo-small',
    medium: 'leaf-logo-medium',
    large: 'leaf-logo-large'
  };

  return (
    <div className={`leaf-logo ${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Circular Background */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="#16a34a"
        />
        {/* Truck Icon */}
        <g transform="translate(50, 50)">
          {/* Truck Body */}
          <rect x="-25" y="-8" width="30" height="16" rx="2" fill="white" />
          {/* Truck Cabin */}
          <rect x="5" y="-12" width="15" height="20" rx="2" fill="white" />
          {/* Window */}
          <rect x="7" y="-10" width="11" height="8" rx="1" fill="#16a34a" />
          {/* Wheels */}
          <circle cx="-10" cy="8" r="6" fill="#16a34a" />
          <circle cx="15" cy="8" r="6" fill="#16a34a" />
          <circle cx="-10" cy="8" r="3" fill="white" />
          <circle cx="15" cy="8" r="3" fill="white" />
        </g>
      </svg>
    </div>
  );
}

