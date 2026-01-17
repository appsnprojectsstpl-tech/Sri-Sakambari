'use client';

import { useRouter } from 'next/navigation';
import { Phone, Sparkles, Home } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { t } from '@/lib/translations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Languages } from 'lucide-react';
import { FlashDealCard } from '@/components/flash-deal';

const services = [
  'Nurse',
  'Electrician',
  'Plumber',
  'House Cleaning',
  'Drivers',
  'Catering',
];

const WHATSAPP_NUMBER = '919603791432';

const generateWhatsAppLink = (message: string) => {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
};

export default function VisitingCardPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();

  return (
    // Added pb-24 to body to account for sticky footer
    <div className="min-h-screen w-full bg-[#FFC324] text-[#FF0000] font-sans p-4 sm:p-6 flex flex-col pb-24 sm:pb-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link href="/dashboard" className='flex items-center gap-2'>
            <Image
              src="https://image2url.com/images/1765782592895-e331e0be-b91b-499e-abc2-ad62b01b50c3.png"
              alt="Sri Sakambari Devi Logo"
              width={64}
              height={64}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-white shadow-lg"
              priority
            />
            <h1 className="text-xl sm:text-3xl font-bold font-headline leading-tight text-[#FF0000]" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Sri Sakambari Devi<br />{t('vegetableMarket', language)}
            </h1>
          </Link>
        </div>
        <div className='flex items-center justify-between w-full sm:w-auto gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#FF0000] hover:text-[#FF0000] hover:bg-white/20 h-11 w-11">
                <Languages className="h-6 w-6" />
                <span className="sr-only">Change language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="h-11" onSelect={() => setLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem className="h-11" onSelect={() => setLanguage('te')}>Telugu</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="text-right text-base sm:text-lg font-medium text-[#FF0000]">
            <p className="text-lg sm:text-xl">Raju</p>
            <a href="tel:9603791432" className="flex items-center justify-end gap-1 font-bold text-lg sm:text-xl p-2 -mr-2">
              <Phone className="w-5 h-5" />
              <span>9603791432</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start text-center gap-6 sm:gap-8">

        <div className="flex flex-col items-center gap-6 w-full">

          {/* Hidden on mobile, sticky nav handles home there if needed, currently visiting card usually is home */}
          <Link href="/dashboard" className="flex text-[#FF0000] hover:opacity-80 transition-opacity">
            <Home className="w-16 h-16" />
            <span className="sr-only">Go to Home</span>
          </Link>

          <h2 className="text-xl sm:text-4xl font-extrabold tracking-widest uppercase font-headline text-[#FF0000]">
            {t('directFromFarms', language)}
          </h2>
          <p className="text-sm sm:text-lg font-bold text-[#FF0000] -mt-4">
            {t('cutVegAndDoorDelivery', language)} <span className="text-[10px] sm:text-xs opacity-80">({t('conditionsApply', language)})</span>
          </p>

          <FlashDealCard />

          {/* Native Mobile Carousel - CSS Snap */}
          <div className="w-full overflow-x-auto no-scrollbar snap-x snap-mandatory flex gap-4 px-4 pb-4 -mx-4 sm:grid sm:grid-cols-2 sm:gap-8 sm:w-auto sm:mx-auto sm:pb-0">
            <Link href="/vegetables" className="snap-center shrink-0 w-[80vw] sm:w-auto group block text-center p-2 rounded-lg active:bg-white/10 transition-colors">
              <div className="relative w-full aspect-video sm:w-32 sm:h-32 mx-auto mb-2 overflow-hidden rounded-xl sm:rounded-full border-4 border-white shadow-2xl transition-transform group-hover:scale-105">
                <Image src="https://cdn.pixabay.com/photo/2015/05/30/01/18/vegetables-790022_1280.jpg" alt={t('Vegetables', language)} fill className="object-cover" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#FF0000]">{t('Vegetables', language)}</h3>
              <p className="text-sm sm:text-sm text-[#FF0000]">{t('shopFreshAndGreen', language)}</p>
            </Link>
            <Link href="/fruits" className="snap-center shrink-0 w-[80vw] sm:w-auto group block text-center p-2 rounded-lg active:bg-white/10 transition-colors">
              <div className="relative w-full aspect-video sm:w-32 sm:h-32 mx-auto mb-2 overflow-hidden rounded-xl sm:rounded-full border-4 border-white shadow-2xl transition-transform group-hover:scale-105">
                <Image src="https://cdn.pixabay.com/photo/2018/05/14/12/31/fruit-3399834_1280.jpg" alt={t('Fruits', language)} fill className="object-cover" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#FF0000]">{t('Fruits', language)}</h3>
              <p className="text-sm sm:text-sm text-[#FF0000]">{t('sweetAndJuicy', language)}</p>
            </Link>
          </div>

          <section className="w-full max-w-2xl mt-4 sm:mt-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <h3 className="text-2xl sm:text-3xl font-semibold mb-3 flex items-center justify-center gap-2 text-[#FF0000]"><Sparkles className="w-6 h-6 sm:w-8 sm:h-8" /> {t('availableServices', language)}</h3>
              <p className="text-base sm:text-lg opacity-80 mb-3 text-[#FF0000]">{t('clickToRequestService', language)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center text-[#FF0000]">
                {services.map((service) => (
                  <a
                    key={service}
                    href={generateWhatsAppLink(`Hi, I need a ${service}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#FFF200] border-2 border-[#FF0000] rounded-lg p-3 text-base sm:text-xl font-bold transition-transform hover:scale-105 hover:bg-[#FFD700] text-[#FF0000] min-h-[44px] flex items-center justify-center"
                  >
                    {t(service, language)}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Sticky Mobile Footer Action */}
      <div className="fixed bottom-4 left-4 right-4 z-50 sm:static sm:block sm:w-full sm:max-w-md sm:mx-auto">
        <a
          href={generateWhatsAppLink('Hi, I would like to place an order.')}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-green-500 text-white font-bold py-4 px-6 rounded-full text-xl sm:text-2xl shadow-lg transition-transform hover:scale-105 border-2 border-white sm:border-transparent flex items-center justify-center gap-2"
        >
          <Phone className="w-6 h-6" />
          {t('orderOnWhatsApp', language)}
        </a>
      </div>
    </div >
  );
}
