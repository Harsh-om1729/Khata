import { useEffect, useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { useServices } from '../services';
import { useStaffSession } from '../staff/session';
import { canUnlock, type StaffMember } from '../staff/types';
import { Icon } from './Icon';
import { PinPad } from './PinPad';

export function StaffArea() {
  const { t } = useI18n();
  const { staffDirectory } = useServices();
  const session = useStaffSession();
  const [members, setMembers] = useState<StaffMember[]>(() => staffDirectory.cached());
  const [chosen, setChosen] = useState<StaffMember | null>(null);

  useEffect(() => {
    // Offline or not yet approved: keep the saved list.
    staffDirectory.refresh().then(setMembers, () => {});
  }, []);

  if (session.active) {
    return (
      <section class="active-staff">
        <span>
          <Icon name="person" /> {t.activeStaff} <strong>{session.active.name}</strong>
        </span>
        <button type="button" class="btn" onClick={session.lock}>
          <Icon name="lock" />
          {t.lockNow}
        </button>
      </section>
    );
  }

  if (chosen) {
    return (
      <PinPad
        member={chosen}
        onCancel={() => setChosen(null)}
        onUnlocked={() => {
          session.unlock(chosen);
          setChosen(null);
        }}
      />
    );
  }

  const unlockable = members.filter(canUnlock);
  return (
    <section class="staff-picker">
      <h2>{unlockable.length > 0 ? t.staffChoose : t.staffNone}</h2>
      <div class="tiles">
        {unlockable.map((member) => (
          <button key={member.id} type="button" class="tile" onClick={() => setChosen(member)}>
            <span class="tile__avatar" aria-hidden="true">
              {member.name.charAt(0)}
            </span>
            <span class="tile__name">{member.name}</span>
            {member.is_owner && <span class="tile__badge">{t.owner}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
