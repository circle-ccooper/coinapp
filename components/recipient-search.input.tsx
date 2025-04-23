'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User as UserIcon, Check, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useWeb3 } from '@/components/web3-provider';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';

interface RecipientSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

interface UserWallet {
  id: string;
  email: string;
  name?: string;
  username: string
  wallet_address: string;
  blockchain: string;
}

export function RecipientSearchInput({
  value,
  onChange,
  required = false
}: RecipientSearchInputProps): React.ReactNode {
  const [searchResults, setSearchResults] = useState<UserWallet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<{ email?: string, name?: string } | null>(null);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [user, setUser] = useState<User>();

  const { activeChain } = useWeb3();
  const supabase = createSupabaseBrowserClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Validate Ethereum address format
  const validateAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Handle manual input of address
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear user info if input is changed
    if (userInfo) setUserInfo(null);

    // Only validate complete addresses (starting with 0x)
    if (newValue.startsWith('0x') && newValue.length >= 42) {
      setIsValid(validateAddress(newValue));
    } else {
      setIsValid(true);
      // If it's not a complete address, treat it as a search query
      if (newValue.length >= 2) {
        searchUsers(newValue);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }
  };

  // Search for users in the database
  const searchUsers = async (query: string): Promise<void> => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      // First, get all profiles
      const profileResponse = await supabase
        .from('profiles')
        .select()
        .neq('auth_user_id', user?.id)
        .limit(15);

      const { data: allProfiles, error: profileError } = profileResponse;

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
      }

      // Filter profiles client-side by query
      const queryLower = query.toLowerCase();
      const profiles = allProfiles.filter(profile =>
        (profile.username && profile.username.toLowerCase().includes(queryLower))
      );

      if (!profiles || profiles.length === 0) {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }

      // Then, get wallets for these profiles
      const profileIds = profiles.map(p => p.id);

      const walletResponse = await supabase
        .from('wallets')
        .select()
        .in('profile_id', profileIds);

      const { data: allWallets, error: walletError } = walletResponse;

      if (walletError) {
        console.error('Error fetching wallets:', walletError);
        return;
      }

      // Filter wallets by blockchain - try different formats to handle case sensitivity
      const wallets = allWallets?.filter(wallet =>
        wallet.blockchain?.toUpperCase() === activeChain.toUpperCase() ||
        wallet.blockchain === activeChain
      );

      // Combine profile and wallet data
      const results = profiles
        .map(profile => {
          // Find a wallet for this profile that matches the active chain
          const wallet = wallets?.find(w => w.profile_id === profile.id);
          if (!wallet) {
            return null;
          }

          return {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            username: profile.username,
            wallet_address: wallet.wallet_address,
            blockchain: wallet.blockchain
          };
        })
        .filter(result => result !== null) as UserWallet[];

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a user from search results
  const handleSelectUser = (user: UserWallet): void => {
    onChange(user.wallet_address);
    setUserInfo({
      name: user.username
    });
    setShowResults(false);
    setSearchResults([]);
  };

  // Clear selected user
  const handleClearUser = (): void => {
    onChange('');
    setUserInfo(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update search results when activeChain changes
  useEffect(() => {
    if (value && !value.startsWith('0x') && value.length >= 2) {
      searchUsers(value);
    }
  }, [activeChain, value]);

  // Handle input focus
  const handleFocus = (): void => {
    if (value && !value.startsWith('0x') && value.length >= 2) {
      setShowResults(true);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center relative gap-x-4">
        <Label className="text-base font-semibold" htmlFor="recipient">
          For
        </Label>
        <Input
          id="recipient"
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="0x... or search by email/name"
          required={required}
          className={`pr-20 ${!isValid ? 'border-red-500' : ''}`}
          autoComplete="off"
        />

        {userInfo ? (
          <div className="absolute right-2 flex items-center gap-1">
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {userInfo.name || userInfo.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClearUser}
              type="button"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : validateAddress(value) ? (
          <div className="absolute right-2">
            <Check className="h-4 w-4 text-green-500" />
          </div>
        ) : null}
      </div>

      {!isValid && (
        <p className="text-xs text-red-500 mt-1">
          Invalid Ethereum address format
        </p>
      )}

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-10 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border mt-1 max-h-60 overflow-auto"
        >
          <div className="p-1">
            {searchResults.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="flex items-center justify-between px-2 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
              >
                <div className="flex items-center">
                  <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{user.username}</span>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResults && isLoading && (
        <div
          className="absolute z-10 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border mt-1 p-2 text-center text-sm text-muted-foreground"
        >
          Searching...
        </div>
      )}

      {showResults && !isLoading && searchResults.length === 0 && value && value.length >= 2 && (
        <div
          className="absolute z-10 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border mt-1 p-2 text-center text-sm text-muted-foreground"
        >
          No users found with wallet on {activeChain.toUpperCase()} chain.
        </div>
      )}
    </div>
  );
}