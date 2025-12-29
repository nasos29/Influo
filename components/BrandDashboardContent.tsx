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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-2xl font-bold text-slate-900">{txt.agreement_terms}</h3>
              <button
                onClick={() => {
                  setShowAgreementModal(false);
                  setSelectedProposal(null);
                  setAgreementAccepted(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Proposal Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                <h4 className="font-bold text-blue-900 mb-4 text-lg">
                  {lang === 'el' ? 'Σύνοψη Συμφωνίας' : 'Agreement Summary'}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{txt.influencer}:</span>
                    <span className="text-blue-900 font-bold">{influencers[selectedProposal.influencer_id]?.display_name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{txt.service}:</span>
                    <span className="text-blue-900 font-bold">{selectedProposal.service_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 font-medium">{txt.budget}:</span>
                    <span className="text-blue-900 font-bold text-lg">
                      €{selectedProposal.counter_proposal_budget || selectedProposal.budget}
                    </span>
                  </div>
                  {selectedProposal.description && (
                    <div className="pt-3 border-t border-blue-200">
                      <span className="text-blue-700 font-medium">{txt.description}:</span>
                      <p className="text-blue-800 mt-1">{selectedProposal.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Benefits Section */}
              {lang === 'el' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                    <span>✨</span> Τι Κερδίζετε με την Αποδοχή
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-900">Επιβεβαίωση Συνεργασίας</p>
                        <p className="text-sm text-green-700">Η συνεργασία ολοκληρώνεται και ξεκινά η εκπόνηση</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🤝</span>
                      <div>
                        <p className="font-semibold text-green-900">Επαγγελματική Σχέση</p>
                        <p className="text-sm text-green-700">Δημιουργείται επίσημη σχέση συνεργασίας</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">📈</span>
                      <div>
                        <p className="font-semibold text-green-900">Αξιολόγηση</p>
                        <p className="text-sm text-green-700">Θα μπορείτε να αξιολογήσετε τον/την influencer μετά την ολοκλήρωση</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <p className="font-semibold text-green-900">Περιεχόμενο Υψηλής Ποιότητας</p>
                        <p className="text-sm text-green-700">Εγγύηση για την ποιότητα και την προθεσμία παράδοσης</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                    <span>✨</span> What You Gain by Accepting
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-green-900">Collaboration Confirmation</p>
                        <p className="text-sm text-green-700">The collaboration is finalized and work begins</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🤝</span>
                      <div>
                        <p className="font-semibold text-green-900">Professional Relationship</p>
                        <p className="text-sm text-green-700">Official collaboration relationship is established</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">📈</span>
                      <div>
                        <p className="font-semibold text-green-900">Review Ability</p>
                        <p className="text-sm text-green-700">You can review the influencer after completion</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎯</span>
                      <div>
                        <p className="font-semibold text-green-900">High-Quality Content</p>
                        <p className="text-sm text-green-700">Guarantee for quality and delivery deadlines</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Terms & Conditions */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-lg">
                  {lang === 'el' ? 'Όροι Χρήσης & Συμφωνία' : 'Terms & Conditions'}
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-h-96 overflow-y-auto text-sm text-slate-700 space-y-4">
                  {lang === 'el' ? (
                    <>
                      <div>
                        <p className="font-bold text-slate-900 mb-2">1. Υποχρεώσεις Επιχείρησης:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Πληρωμή σύμφωνα με τις προδιαγραφές της συμφωνίας</li>
                          <li>Παροχή όλων των απαραίτητων υλικών και πληροφοριών στον/στην influencer</li>
                          <li>Επικοινωνία σε εύλογο χρόνο για οποιαδήποτε απορία ή αλλαγή</li>
                          <li>Σεβασμός των προθεσμιών και deadlines που έχουν συμφωνηθεί</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">2. Πληρωμή:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Η πληρωμή θα γίνει σύμφωνα με τις προδιαγραφές της προσφοράς</li>
                          <li>Η πληρωμή θα πραγματοποιηθεί μετά την ολοκλήρωση και έγκριση του περιεχομένου</li>
                          <li>Οι όροι πληρωμής αναφέρονται στη συμφωνία</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">3. Δικαιώματα:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Έχετε δικαίωμα έγκρισης/απόρριψης περιεχομένου πριν τη δημοσίευση</li>
                          <li>Μπορείτε να χρησιμοποιήσετε το περιεχόμενο για marketing σκοπούς</li>
                          <li>Ο/Η influencer διατηρεί τα δικαιώματα του περιεχομένου εκτός αν συμφωνηθεί διαφορετικά</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">4. Επικοινωνία & Συνεργασία:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Η επικοινωνία θα γίνεται μέσω της πλατφόρμας Influo</li>
                          <li>Οι δύο πλευρές δεσμεύονται για επαγγελματική και σεβαστική επικοινωνία</li>
                          <li>Οποιαδήποτε αλλαγή στη συμφωνία θα πρέπει να συζητηθεί και να συμφωνηθεί</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">5. Εμπιστευτικότητα:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Και οι δύο πλευρές δεσμεύονται να διατηρήσουν εμπιστευτικότητα</li>
                          <li>Προσωπικά στοιχεία και πληροφορίες παραμένουν εμπιστευτικά</li>
                        </ul>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                        <p className="font-medium text-amber-900 mb-2">
                          ⚠️ <strong>Σημαντικό:</strong> Με την αποδοχή αυτής της συμφωνίας:
                        </p>
                        <ul className="text-amber-800 space-y-1 list-disc list-inside ml-2 text-xs">
                          <li>Συμφωνείτε με όλους τους παραπάνω όρους χρήσης</li>
                          <li>Η συνεργασία θεωρείται επίσημα ξεκίνημενη</li>
                          <li>Θα μπορείτε να αξιολογήσετε τον/την influencer μετά την ολοκλήρωση</li>
                          <li>Το brand θα προστεθεί στο portfolio του/της influencer</li>
                          <li>Η πλατφόρμα Influo λειτουργεί ως μεσάζων για την ομαλή εξέλιξη της συνεργασίας</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold text-slate-900 mb-2">1. Company Obligations:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Payment according to agreement specifications</li>
                          <li>Provision of all necessary materials and information to the influencer</li>
                          <li>Communication in reasonable time for any questions or changes</li>
                          <li>Respect for agreed deadlines</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">2. Payment:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Payment will be made according to proposal specifications</li>
                          <li>Payment will occur after completion and approval of content</li>
                          <li>Payment terms are stated in the agreement</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">3. Rights:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>You have the right to approve/reject content before publication</li>
                          <li>You can use the content for marketing purposes</li>
                          <li>The influencer retains content rights unless otherwise agreed</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">4. Communication & Collaboration:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Communication will be through the Influo platform</li>
                          <li>Both parties commit to professional and respectful communication</li>
                          <li>Any changes to the agreement must be discussed and agreed upon</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 mb-2">5. Confidentiality:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1 text-slate-700">
                          <li>Both parties commit to maintaining confidentiality</li>
                          <li>Personal data and information remain confidential</li>
                        </ul>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                        <p className="font-medium text-amber-900 mb-2">
                          ⚠️ <strong>Important:</strong> By accepting this agreement:
                        </p>
                        <ul className="text-amber-800 space-y-1 list-disc list-inside ml-2 text-xs">
                          <li>You agree to all the above terms of service</li>
                          <li>The collaboration is considered officially started</li>
                          <li>You can review the influencer after completion</li>
                          <li>The brand will be added to the influencer's portfolio</li>
                          <li>The Influo platform acts as an intermediary for smooth collaboration</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Acceptance Checkbox */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    {lang === 'el' ? (
                      <>
                        <strong>Αποδέχομαι τους όρους χρήσης</strong> και συμφωνώ να προχωρήσω στη συνεργασία με τον/την <strong>{influencers[selectedProposal.influencer_id]?.display_name || 'influencer'}</strong> σύμφωνα με τους όρους που έχουν συμφωνηθεί.
                      </>
                    ) : (
                      <>
                        <strong>I accept the terms of service</strong> and agree to proceed with the collaboration with <strong>{influencers[selectedProposal.influencer_id]?.display_name || 'influencer'}</strong> according to the agreed terms.
                      </>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowAgreementModal(false);
                  setSelectedProposal(null);
                  setAgreementAccepted(false);
                }}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
              </button>
              <button
                onClick={handleAcceptAgreement}
                disabled={!agreementAccepted || savingAgreement}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
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

