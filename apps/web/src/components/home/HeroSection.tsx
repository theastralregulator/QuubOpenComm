import React from 'react';
import HomeHeroCarousel from './HomeHeroCarousel';
import { Job, Worker } from '../../types';

interface HeroSectionProps {
  userFullName?: string;
  isLoggedIn?: boolean;
  onAboutClick?: () => void;
  jobs?: Job[];
  workers?: Worker[];
  unreadMessagesCount?: number;
}

export default function HeroSection(props: HeroSectionProps) {
  return <HomeHeroCarousel {...props} />;
}
