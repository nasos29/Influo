"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Proposal {
  id: string;
  influencer_id: string;
  brand_name: string;
  brand_email: string;
  brand_id?: string;
  service_type: string;
  budget: number;
  counter_proposal_budget?: number;
  status: string;
  description?: string;
  created_at: string;
  influencer_agreement_accepted: boolean;
  brand_agreement_accepted: boolean;
  counter_proposal_status?: string;
}

interface Influencer {
  id: string;
  display_name: string;
  avatar_url?: string;
}

const t = {
  el: {
    title: "Dashboard Επιχείρησης",
    logout: "Αποσύνδεση",
    pending_agreements: "Συμφωνίες που αναμένουν αποδοχή",
    no_pending: "Δεν υπάρχουν συμφωνίες που αναμένουν αποδοχή",
    proposal_details: "Λεπτομέρειες Πρότασης",
    influencer: "Influencer",
    service: "Υπηρεσία",
    budget: "Budget",
    description: "Περιγραφή",
    accept_agreement: "Αποδοχή Συμφωνίας",
    agreement_terms: "Όροι Χρήσης",
    agreement_text: "Με την αποδοχή αυτής της συμφωνίας, συμφωνώ με τους όρους χρήσης της πλατφόρμας Influo και επιβεβαιώνω ότι είμαι πρόθυμος να προχωρήσω στη συνεργασία με τους όρους που έχουν συμφωνηθεί.",
    accepted: "Αποδεκτή",
    pending: "Εκκρεμής",
    loading: "Φόρτωση...",
    error: "Σφάλμα"
  },
  en: {
    title: "Company Dashboard",
    logout: "Logout",
    pending_agreements: "Agreements Pending Acceptance",
    no_pending: "No agreements pending acceptance",
    proposal_details: "Proposal Details",
    influencer: "Influencer",
    service: "Service",
    budget: "Budget",
    description: "Description",
    accept_agreement: "Accept Agreement",
    agreement_terms: "Terms of Service",
    agreement_text: "By accepting this agreement, I agree to the Influo platform terms of service and confirm that I am willing to proceed with the collaboration under the agreed terms.",
    accepted: "Accepted",
    pending: "Pending",
    loading: "Loading...",
    error: "Error"
  }
};

export default function BrandDashboardContent() {
  const [lang, setLang] = useState<'el' | 'en'>('el');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [influencers, setInfluencers] = useState<Record<string, Influencer>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);
  const router = useRouter();
  const txt = t[lang];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/brand/login');
        return;
      }

      // Get brand data
      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!brandData) {
        router.push('/brand/login');
        return;
      }

      // Get proposals for this brand (by email or brand_id)
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('proposals')
        .select('*')
        .or(`brand_email.eq.${brandData.contact_email},brand_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (proposalsError) throw proposalsError;

      if (proposalsData) {
        setProposals(proposalsData as Proposal[]);

        // Get unique influencer IDs
        const influencerIds = [...new Set(proposalsData.map((p: Proposal) => p.influencer_id))];

        // Fetch influencer data
        if (influencerIds.length > 0) {
          const { data: influencersData } = await supabase
            .from('influencers')
            .select('id, display_name, avatar_url')
            .in('id', influencerIds);

          if (influencersData) {
            const influencersMap: Record<string, Influencer> = {};
            influencersData.forEach((inf: Influencer) => {
              influencersMap[inf.id] = inf;
            });
            setInfluencers(influencersMap);
          }
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAgreement = async () => {
    if (!selectedProposal || !agreementAccepted) {
      alert(lang === 'el' 
        ? 'Παρακαλώ αποδεχτείτε τους όρους χρήσης' 
        : 'Please accept the terms of service');
      return;
    }

    setSavingAgreement(true);
    try {
      const response = await fetch('/api/proposals/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: selectedProposal.id,
          userType: 'brand',
          accepted: true
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        setShowAgreementModal(false);
        setSelectedProposal(null);
        setAgreementAccepted(false);
        alert(lang === 'el' 
          ? 'Η συμφωνία αποδεχτήθηκε!' 
          : 'Agreement accepted!');
      } else {
        throw new Error(result.error || 'Error accepting agreement');
      }
    } catch (err: any) {
      console.error('Error accepting agreement:', err);
      alert(err.message || txt.error);
    } finally {
      setSavingAgreement(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/brand/login');
  };

  // Get pending agreements (where influencer accepted but brand hasn't)
  const pendingAgreements = proposals.filter(
    p => p.influencer_agreement_accepted && !p.brand_agreement_accepted && 
    (p.status === 'accepted' || p.status === 'completed')
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{txt.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">{txt.title}</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {lang === 'el' ? 'EN' : 'ΕΛ'}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {txt.logout}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.pending_agreements}</h2>
          
          {pendingAgreements.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{txt.no_pending}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingAgreements.map((proposal) => {
                const influencer = influencers[proposal.influencer_id];
                return (
                  <div
                    key={proposal.id}
                    className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                          {influencer?.display_name || 'Unknown Influencer'}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">{txt.service}:</span>{' '}
                            <span className="font-medium text-slate-900">{proposal.service_type}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">{txt.budget}:</span>{' '}
                            <span className="font-medium text-slate-900">
                              €{proposal.counter_proposal_budget || proposal.budget}
                            </span>
                          </div>
                        </div>
                        {proposal.description && (
                          <div className="mt-2 text-sm text-slate-600">
                            <span className="text-slate-500">{txt.description}:</span>{' '}
                            {proposal.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProposal(proposal);
                          setShowAgreementModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {txt.accept_agreement}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Agreement Modal */}
      {showAgreementModal && selectedProposal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">{txt.agreement_terms}</h3>
            <div className="mb-6">
              <p className="text-sm text-slate-600 mb-4">{txt.agreement_text}</p>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-500">{txt.influencer}:</span>{' '}
                    <span className="font-medium">{influencers[selectedProposal.influencer_id]?.display_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{txt.service}:</span>{' '}
                    <span className="font-medium">{selectedProposal.service_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{txt.budget}:</span>{' '}
                    <span className="font-medium">
                      €{selectedProposal.counter_proposal_budget || selectedProposal.budget}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(e) => setAgreementAccepted(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  {lang === 'el' 
                    ? 'Αποδέχομαι τους όρους χρήσης' 
                    : 'I accept the terms of service'}
                </span>
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAgreementModal(false);
                  setSelectedProposal(null);
                  setAgreementAccepted(false);
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
              </button>
              <button
                onClick={handleAcceptAgreement}
                disabled={!agreementAccepted || savingAgreement}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {savingAgreement ? txt.loading : txt.accept_agreement}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

