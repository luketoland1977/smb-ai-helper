import { Button } from "@/components/ui/button";
import { Bot, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleAuthAction = () => {
    if (user) {
      signOut();
    } else {
      navigate('/auth');
    }
  };

  const handleDashboardAction = () => {
    navigate('/admin-panel');
  };

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
            {user ? (
              <>
                {(hasRole('admin') || hasRole('salesperson') || hasRole('support')) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-white border-white hover:bg-white/10"
                    onClick={handleDashboardAction}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Admin Panel
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-white border-white hover:bg-white/10"
                  onClick={handleAuthAction}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-white border-white hover:bg-white/10"
                  onClick={handleAuthAction}
                >
                  Login
                </Button>
                <Button variant="accent" size="sm" onClick={handleAuthAction}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;