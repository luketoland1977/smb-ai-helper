import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <Bot className="h-8 w-8 text-accent" />
              <span className="text-xl font-bold text-white">AI Service Pro</span>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="#solutions" className="text-white/90 hover:text-white transition-colors px-3 py-2 text-sm font-medium">
                Solutions
              </a>
              <a href="#pricing" className="text-white/90 hover:text-white transition-colors px-3 py-2 text-sm font-medium">
                Pricing
              </a>
              <a href="#about" className="text-white/90 hover:text-white transition-colors px-3 py-2 text-sm font-medium">
                About
              </a>
              <a href="#contact" className="text-white/90 hover:text-white transition-colors px-3 py-2 text-sm font-medium">
                Contact
              </a>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="text-white border-white hover:bg-white/10">
              Login
            </Button>
            <Button variant="accent" size="sm">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;