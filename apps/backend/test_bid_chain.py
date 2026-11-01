from datetime import datetime, timedelta, timezone
import unittest

import env
from services.chain import assess_chain, bid_message, genesis_message, sign


STARTS = datetime(2026, 11, 1, 18, 1, tzinfo = timezone.utc)
CREATED = datetime(2026, 11, 1, 18, 2, 3, 4, tzinfo = timezone.utc)


class BidChainTest(unittest.TestCase):
    def setUp(self):
        self.previous_secret = env.AUDIT_SECRET
        env.AUDIT_SECRET = 'dev-audit-secret-separado-do-token'

    def tearDown(self):
        env.AUDIT_SECRET = self.previous_secret

    def test_mensagem_canonica_e_adulteracao(self):
        naive = datetime(2026, 11, 1, 18, 1)
        local = datetime(2026, 11, 1, 15, 1, tzinfo = timezone(timedelta(hours = -3)))
        genesis = 'lot|7|1000|100|2026-11-01T18:01:00.000000+00:00'

        self.assertEqual(genesis_message(7, 1000, 100, STARTS), genesis)
        self.assertEqual(genesis_message(7, 1000, 100, naive), genesis)
        self.assertEqual(genesis_message(7, 1000, 100, local), genesis)

        prev = sign(genesis)
        message = bid_message(7, 1, 3, 1500, CREATED, prev)
        self.assertEqual(
            message,
            f'7|1|3|1500|2026-11-01T18:02:03.000004+00:00|{prev}',
        )
        digest = sign(message)
        self.assertEqual(len(digest), 64)
        self.assertEqual(digest, digest.lower())
        self.assertTrue(all(char in '0123456789abcdef' for char in digest))

        second_at = datetime(2026, 11, 1, 18, 3, tzinfo = timezone.utc)
        second_message = bid_message(7, 2, 4, 2500, second_at, digest)
        second = sign(second_message)
        bids = [
            {
                'id': 1,
                'position': 1,
                'bidder_id': 3,
                'amount_cents': 1500,
                'created_at': CREATED,
                'prev_hash': prev,
                'hash': digest,
            },
            {
                'id': 2,
                'position': 2,
                'bidder_id': 4,
                'amount_cents': 2500,
                'created_at': second_at,
                'prev_hash': digest,
                'hash': second,
            },
        ]
        fields = {
            'lot_id': 7,
            'minimum_bid_cents': 1000,
            'increment_cents': 100,
            'starts_at': STARTS,
            'settlement': None,
        }
        intact, head = assess_chain(bids = bids, **fields)
        self.assertTrue(intact)
        self.assertEqual(head, second)

        bids[0]['amount_cents'] = 1501
        intact, head = assess_chain(bids = bids, **fields)
        self.assertFalse(intact)
        self.assertEqual(head, second)

    def test_segredo_ausente_falha(self):
        env.AUDIT_SECRET = ''

        with self.assertRaises(RuntimeError) as caught:
            sign('lot|1|1|1|2026-11-01T18:01:00.000000+00:00')

        self.assertIn('AUDIT_SECRET', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
