import React from 'react';
import { MessageCircle, Truck } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useContent } from '@/hooks/useContent';

export default function FloatingButtons() {
  const whatsappUrl = useContent('global.links.whatsapp', 'https://wa.me/233244753849');
  const towTooltip = useContent('global.floatingButtons.towTooltip', 'Request Emergency Tow');
  const whatsappTooltip = useContent('global.floatingButtons.whatsappTooltip', 'Chat on WhatsApp');

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2.5 sm:gap-3">
      {/* Tow Button */}
      <Link to="/towing" className="block" aria-label={towTooltip}>
        <motion.div 
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-accent hover:bg-accent/95 text-white rounded-full shadow-xl shadow-red-600/30 transition-all border-2 border-white/20 cursor-pointer"
        >
          <Truck className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
          <span className="hidden sm:block absolute right-full mr-3.5 bg-dark text-white text-xs font-semibold px-3 py-2 rounded-[1px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl pointer-events-none">
            {towTooltip}
            <span className="absolute top-1/2 -right-1 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-dark"></span>
          </span>
        </motion.div>
      </Link>

      {/* WhatsApp Button */}
      <a 
        href={whatsappUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block"
        aria-label={whatsappTooltip}
      >
        <motion.div 
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-xl shadow-primary/30 transition-all border-2 border-white/20 cursor-pointer"
        >
          <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="hidden sm:block absolute right-full mr-3.5 bg-dark text-white text-xs font-semibold px-3 py-2 rounded-[1px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl pointer-events-none">
            {whatsappTooltip}
            <span className="absolute top-1/2 -right-1 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-dark"></span>
          </span>
        </motion.div>
      </a>
    </div>
  );
}
